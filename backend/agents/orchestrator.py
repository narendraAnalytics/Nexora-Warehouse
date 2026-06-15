"""
Nexora Orchestrator — supervisor StateGraph that routes tasks to domain agents,
collects outputs, and manages HITL approval gates via Redis + LangGraph checkpointer.

Architecture:
  START → supervisor → invoke_agents → hitl_gate → [post_approval (paused)] | END
                                                         ↓ (after approval)
                                                     post_approval → END
"""
from typing import Annotated

import asyncpg
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field
from typing_extensions import TypedDict

from llm_factory import get_llm_pro
from memory.redis_manager import RedisMemoryManager

# ── State ─────────────────────────────────────────────────────────────────────

class OrchestratorState(TypedDict):
    messages: Annotated[list, add_messages]
    task: str
    warehouse_id: str | None
    target_agents: list[str]
    agent_outputs: dict
    approval_type: str | None
    approval_id: str | None
    thread_id: str


# ── Supervisor structured output ───────────────────────────────────────────────

_VALID_AGENTS = [
    "inventory", "demand_forecast", "procurement", "supplier_risk",
    "warehouse_transfer", "logistics", "order_fulfillment",
    "risk_intelligence", "finance", "knowledge", "communication",
]

_AGENT_DESCRIPTIONS = """
- inventory: stock levels, reorder alerts, overstock detection, transfer opportunities
- demand_forecast: demand velocity, stockout risk, slow movers, sales trends
- procurement: reorder candidates, draft PO creation, supplier selection
- supplier_risk: supplier risk scores, overdue POs, alternative suppliers
- warehouse_transfer: warehouse balancing, inter-branch transfer recommendations
- logistics: dispatch queue, active deliveries, delivery performance, create dispatch
- order_fulfillment: order pipeline, delayed orders, order details, order escalation
- risk_intelligence: cross-domain risk dashboard, supply chain risks, operational risks
- finance: revenue analysis, cash flow, profit margins, financial dashboard
- knowledge: SOPs, supplier policies, logistics rules, executive decisions (RAG search)
- communication: send alert emails, escalation emails, executive reports via Resend
"""

_SUPERVISOR_PROMPT = f"""You are the Nexora Orchestrator supervisor.

Your job: read the user's task and select the minimal set of agents needed to complete it.

Available agents and their capabilities:
{_AGENT_DESCRIPTIONS}

Rules:
1. Select only agents directly needed — do not add agents speculatively.
2. For financial + communication tasks, select both finance AND communication.
3. For inventory + procurement tasks, select both inventory AND procurement.
4. For risk analysis, select risk_intelligence (it already aggregates all domains).
5. Maximum 3 agents per task unless the task explicitly spans more domains.
6. knowledge is only needed for policy/SOP questions.

Return a JSON with "agents" (list of agent names from the valid list) and "reasoning".
"""


class AgentSelection(BaseModel):
    agents: list[str] = Field(description="Agent names to invoke, from the valid list")
    reasoning: str = Field(description="One sentence explaining why these agents were chosen")


# ── HITL detection helpers ─────────────────────────────────────────────────────

_HITL_RULES = [
    ("purchase_order",       ["po-", "purchase order created", "draft po", "draft purchase"]),
    ("stock_transfer",       ["trf-", "transfer created", "draft transfer", "stock transfer"]),
    ("supplier_replacement", ["supplier replacement", "alternative supplier recommended"]),
    ("escalation",           ["escalated", "marked urgent", "priority set to urgent"]),
]


def _detect_approval(agent_outputs: dict) -> str | None:
    combined = " ".join(agent_outputs.values()).lower()
    for approval_type, keywords in _HITL_RULES:
        if any(kw in combined for kw in keywords):
            return approval_type
    return None


# ── Factory ────────────────────────────────────────────────────────────────────

def create_orchestrator_graph(
    pool: asyncpg.Pool,
    memory: RedisMemoryManager,
    agent_graphs: dict,
    checkpointer,
):
    """Return compiled Orchestrator StateGraph with checkpointer for HITL support."""

    supervisor_llm = get_llm_pro().with_structured_output(AgentSelection)

    # ── Node: supervisor ───────────────────────────────────────────────────────
    async def supervisor(state: OrchestratorState) -> dict:
        selection: AgentSelection = await supervisor_llm.ainvoke([
            SystemMessage(content=_SUPERVISOR_PROMPT),
            HumanMessage(content=f"Task: {state['task']}"),
        ])
        valid = [a for a in selection.agents if a in _VALID_AGENTS]
        return {
            "target_agents": valid,
            "messages": [AIMessage(content=f"Routing to: {', '.join(valid)}. {selection.reasoning}")],
        }

    # ── Node: invoke_agents ────────────────────────────────────────────────────
    async def invoke_agents(state: OrchestratorState) -> dict:
        outputs: dict = {}
        for name in state["target_agents"]:
            graph = agent_graphs.get(name)
            if graph is None:
                outputs[name] = f"Agent '{name}' not available."
                continue
            # Build agent-specific input — include warehouse_id for agents that support it
            agent_input: dict = {"messages": [HumanMessage(content=state["task"])]}
            if state.get("warehouse_id"):
                agent_input["warehouse_id"] = state["warehouse_id"]
            try:
                result = await graph.ainvoke(agent_input)
                outputs[name] = result["messages"][-1].content
            except Exception as e:
                outputs[name] = f"Error from {name} agent: {str(e)}"

        # Build a summary message of all outputs
        summary_parts = [f"**{name.replace('_', ' ').title()} Agent:**\n{text}"
                         for name, text in outputs.items()]
        summary = "\n\n---\n\n".join(summary_parts)
        return {
            "agent_outputs": outputs,
            "messages": [AIMessage(content=summary)],
        }

    # ── Node: hitl_gate ────────────────────────────────────────────────────────
    async def hitl_gate(state: OrchestratorState) -> dict:
        approval_type = _detect_approval(state.get("agent_outputs", {}))
        if not approval_type:
            return {"approval_type": None, "approval_id": None}

        approval_id = await memory.create_approval(
            approval_type=approval_type,
            payload={
                "thread_id": state["thread_id"],
                "task": state["task"],
                "agent_outputs": state.get("agent_outputs", {}),
                "approval_type": approval_type,
            },
        )
        return {
            "approval_type": approval_type,
            "approval_id": approval_id,
            "messages": [AIMessage(
                content=(
                    f"ACTION REQUIRED: A {approval_type.replace('_', ' ')} requires manager approval.\n"
                    f"Approval ID: {approval_id}\n"
                    f"Use POST /orchestrator/approve/{approval_id} to approve or reject."
                )
            )],
        }

    # ── Node: post_approval ────────────────────────────────────────────────────
    async def post_approval(state: OrchestratorState) -> dict:
        approval_id = state.get("approval_id")
        if not approval_id:
            return {"messages": [AIMessage(content="Workflow completed.")]}

        record = await memory.get_approval(approval_id)
        if not record:
            return {"messages": [AIMessage(content="Approval record not found.")]}

        action = record.get("status", "unknown")
        approval_type = record.get("approval_type", "request")
        resolved_by = record.get("resolved_by", "unknown")

        if action == "approved":
            msg = (
                f"Approved by {resolved_by}. The {approval_type.replace('_', ' ')} "
                f"has been approved and will be processed."
            )
        else:
            msg = (
                f"Rejected by {resolved_by}. The {approval_type.replace('_', ' ')} "
                f"has been cancelled."
            )

        return {"messages": [AIMessage(content=msg)]}

    # ── Routing ────────────────────────────────────────────────────────────────
    def route_hitl(state: OrchestratorState) -> str:
        return "post_approval" if state.get("approval_id") else END

    # ── Graph assembly ─────────────────────────────────────────────────────────
    graph = StateGraph(OrchestratorState)
    graph.add_node("supervisor", supervisor)
    graph.add_node("invoke_agents", invoke_agents)
    graph.add_node("hitl_gate", hitl_gate)
    graph.add_node("post_approval", post_approval)

    graph.add_edge(START, "supervisor")
    graph.add_edge("supervisor", "invoke_agents")
    graph.add_edge("invoke_agents", "hitl_gate")
    graph.add_conditional_edges("hitl_gate", route_hitl)
    graph.add_edge("post_approval", END)

    return graph.compile(
        checkpointer=checkpointer,
        interrupt_before=["post_approval"],  # pause before post_approval until manager approves
    )

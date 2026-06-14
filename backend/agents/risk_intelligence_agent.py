"""
Risk Intelligence Agent — Phase 11
ReAct loop: risk_intelligence_analyst ↔ tool_node until no more tool calls.
Model: llama-3.3-70b-versatile (llm_pro) — cross-domain synthesis requires deep reasoning.
Read-only: aggregates risk signals; remediation delegated to domain agents.
"""
from typing import Annotated
from typing_extensions import TypedDict

import asyncpg
from langchain_core.messages import SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from llm_factory import get_llm_pro
from tools.risk_intelligence_tools import create_risk_intelligence_tools


_SYSTEM_PROMPT = """You are the Risk Intelligence Agent for Nexora Distribution Intelligence Platform.
Nexora is a wholesale electronics distributor with 5 Indian branches: Hyderabad, Bangalore, Chennai, Mumbai, Pune.

Your role is cross-domain risk synthesis — you aggregate risk signals from suppliers, inventory,
operations, and finance into a unified business risk picture with impact assessment and priority actions.

Risk domains you monitor:
1. SUPPLY CHAIN — high-risk suppliers, overdue POs, uncovered stockouts (no open PO)
2. OPERATIONAL — delayed customer orders, overdue deliveries, branch inventory health
3. FINANCIAL — capital locked in overstock, revenue at risk from delays, exposure from late suppliers

Risk severity levels:
- CRITICAL: Immediate action required — financial loss occurring NOW
  • Overdue PO > 7 days from a risk_score >= 7 supplier
  • Customer order delayed > 5 days with value > ₹1,00,000
  • Product with days_remaining < 3 AND no open PO
- HIGH: Action required this week
  • Overdue PO 3–7 days OR risk_score >= 5 supplier with open POs
  • Customer order delayed 3–5 days
  • uncovered_pct > 20% in any branch
- MEDIUM: Monitor and plan
  • Overdue PO 1–3 days
  • Branch understocked_pct > 15%
  • Overstock capital > ₹5,00,000 in a single warehouse
- LOW: Informational
  • All other anomalies

Workflow for a full risk assessment:
Step 1 — Call get_risk_dashboard for the top-level snapshot (counts and values)
Step 2 — Call get_supply_chain_risks for supplier + PO + stockout detail
Step 3 — Call get_operational_risks for order + delivery + branch health detail
Step 4 — Call get_financial_risk_exposure for total INR exposure breakdown
Step 5 — Synthesise: classify each risk signal by severity, estimate business impact, recommend actions

Remediation ownership (you recommend, they act):
- Supplier/PO risks → Supplier Risk Agent + Procurement Agent
- Stockout risks → Procurement Agent
- Order/delivery delays → Order Fulfillment Agent + Logistics Agent
- Branch imbalances → Warehouse Transfer Agent
- Financial exposure → Finance Agent + CEO Agent

Structure your final response as:
**RISK EXECUTIVE SUMMARY** — total_risk_exposure_inr, CRITICAL/HIGH/MEDIUM/LOW counts
**CRITICAL RISKS** — each with: domain, description, INR impact, recommended owner, action
**HIGH RISKS** — same format as critical
**MEDIUM / LOW RISKS** — brief list
**FINANCIAL EXPOSURE BREAKDOWN** — overdue PO value, delayed order value, overstock capital, potential lost sales
**RECOMMENDED ESCALATIONS** — top 3 actions for the CEO/Operations team this week
"""


class RiskIntelligenceAgentState(TypedDict):
    messages: Annotated[list, add_messages]
    warehouse_id: str | None


def create_risk_intelligence_graph(pool: asyncpg.Pool) -> CompiledStateGraph:
    """Build and compile the Risk Intelligence Agent ReAct graph.

    Args:
        pool: asyncpg connection pool — passed to tools via closure.

    Returns compiled StateGraph with ReAct loop: risk_intelligence_analyst → tools → END.
    """
    tools = create_risk_intelligence_tools(pool)
    tool_node = ToolNode(tools)
    llm_with_tools = get_llm_pro().bind_tools(tools)

    async def risk_intelligence_analyst(state: RiskIntelligenceAgentState) -> dict:
        messages = state["messages"]
        if not any(isinstance(m, SystemMessage) for m in messages):
            messages = [SystemMessage(content=_SYSTEM_PROMPT)] + messages
        response = await llm_with_tools.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(RiskIntelligenceAgentState)
    graph.add_node("risk_intelligence_analyst", risk_intelligence_analyst)
    graph.add_node("tools", tool_node)

    graph.add_edge(START, "risk_intelligence_analyst")
    graph.add_conditional_edges("risk_intelligence_analyst", tools_condition)
    graph.add_edge("tools", "risk_intelligence_analyst")

    return graph.compile()

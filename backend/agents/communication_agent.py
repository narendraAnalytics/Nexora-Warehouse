"""
Communication Agent — LangGraph ReAct agent that composes and sends
emails via Resend. Handles operational alerts, manager escalations,
and executive reports. WhatsApp support deferred to a later phase.
"""
from typing import Annotated

from langchain_core.messages import SystemMessage
from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from typing_extensions import TypedDict

from config import Settings
from llm_factory import get_llm_flash
from tools.communication_tools import create_communication_tools

_SYSTEM_PROMPT = """You are the Communication Agent for Nexora Distribution Intelligence Platform.

Your role: compose and send professional emails on behalf of Nexora operations.
You have three email tools — choose the right one based on the instruction.

## Tool Selection

| Situation | Tool |
|-----------|------|
| Stockout, overdue order, supplier delay, inventory issue | send_alert_email |
| Issue requires manager decision, human approval needed | send_escalation_email |
| CEO briefing, weekly summary, strategic report | send_executive_report |

## Composing Messages

Before sending, ensure the message includes:
- **Context**: what happened, where (warehouse/branch), when
- **Impact**: INR value at risk, number of orders/SKUs affected
- **Action required**: what the recipient needs to do and by when
- **Agent recommendation**: what the system suggests

## Rules

1. Never send to an email address that was not explicitly provided in the instruction.
2. Keep subject lines under 60 characters — concise and action-oriented.
3. For escalations, always include a priority level (CRITICAL/HIGH/MEDIUM).
4. For executive reports, use clear sections: Summary, Key Metrics, Risks, Recommendations.
5. After sending, confirm: "Email sent successfully to [address] (Resend ID: [id])."
6. If a tool returns an error, report it clearly and do not retry without new instructions.
"""


class CommunicationAgentState(TypedDict):
    messages: Annotated[list, add_messages]


def create_communication_graph(settings: Settings):
    """Return compiled Communication Agent LangGraph."""
    tools = create_communication_tools(settings)
    tool_node = ToolNode(tools)
    llm_with_tools = get_llm_flash().bind_tools(tools)

    async def communication_agent(state: CommunicationAgentState) -> dict:
        messages = state["messages"]
        if not any(isinstance(m, SystemMessage) for m in messages):
            messages = [SystemMessage(content=_SYSTEM_PROMPT)] + messages
        response = await llm_with_tools.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(CommunicationAgentState)
    graph.add_node("communication_agent", communication_agent)
    graph.add_node("tools", tool_node)

    graph.add_edge(START, "communication_agent")
    graph.add_conditional_edges("communication_agent", tools_condition)
    graph.add_edge("tools", "communication_agent")

    return graph.compile()

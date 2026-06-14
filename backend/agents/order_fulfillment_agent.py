"""
Order Fulfillment Agent — Phase 10
ReAct loop: fulfillment_tracker ↔ tool_node until no more tool calls.
Model: llama-3.1-8b-instant (llm_flash) — operational order tracking.
Write tool: escalate_order sets priority='urgent' and appends timestamped note.
"""
from typing import Annotated
from typing_extensions import TypedDict

import asyncpg
from langchain_core.messages import SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from llm_factory import get_llm_flash
from tools.order_fulfillment_tools import create_order_fulfillment_tools


_SYSTEM_PROMPT = """You are the Order Fulfillment Agent for Nexora Distribution Intelligence Platform.
Nexora is a wholesale electronics distributor with 5 Indian branches: Hyderabad, Bangalore, Chennai, Mumbai, Pune.

Your responsibilities:
1. Monitor the order pipeline across all branches — track orders from creation to delivery
2. Detect delayed orders — orders past due_date not yet fulfilled
3. Investigate stuck orders — identify WHY an order is delayed (no delivery created? in transit but overdue?)
4. Escalate at-risk orders — set priority='urgent' and add escalation notes for human follow-up

Delay classification:
- CRITICAL: days_overdue >= 3 OR (high-value order >₹50,000 AND days_overdue >= 1)
- WARNING:  days_overdue 1–2 AND order value < ₹50,000
- WATCH:    due_date = today AND status not dispatched/fulfilled

Order status flow:
pending → confirmed → processing → dispatched (Logistics Agent) → fulfilled
cancelled is a terminal state — do not escalate cancelled orders.

Escalation decision rules:
- ALWAYS escalate if days_overdue >= 3
- ALWAYS escalate if order value > ₹50,000 AND days_overdue >= 1
- ALWAYS escalate if urgent priority AND not dispatched within 1 day of order creation
- Do NOT escalate orders already at priority='urgent' (already escalated)

Workflow for a full fulfillment review:
Step 1 — Call get_order_pipeline to assess health across all branches
Step 2 — Call get_delayed_orders to find all overdue orders
Step 3 — For each delayed order that meets escalation criteria, call escalate_order
Step 4 — For any specific order needing investigation, call get_order_details
Step 5 — Report fulfillment summary with actions taken

Structure your final response as:
**PIPELINE HEALTH** — orders by status per branch, open value at risk
**DELAYED ORDERS** — list with days_overdue, order value, delivery status
**ESCALATIONS RAISED** — orders escalated to urgent with reasoning
**WATCH LIST** — orders due today that aren't yet dispatched
**RECOMMENDED ACTIONS** — for the Logistics and Communication agents
"""


class OrderFulfillmentAgentState(TypedDict):
    messages: Annotated[list, add_messages]
    warehouse_id: str | None
    order_number: str | None


def create_order_fulfillment_graph(pool: asyncpg.Pool) -> CompiledStateGraph:
    """Build and compile the Order Fulfillment Agent ReAct graph.

    Args:
        pool: asyncpg connection pool — passed to tools via closure.

    Returns compiled StateGraph with ReAct loop: fulfillment_tracker → tools → END.
    """
    tools = create_order_fulfillment_tools(pool)
    tool_node = ToolNode(tools)
    llm_with_tools = get_llm_flash().bind_tools(tools)

    async def fulfillment_tracker(state: OrderFulfillmentAgentState) -> dict:
        messages = state["messages"]
        if not any(isinstance(m, SystemMessage) for m in messages):
            messages = [SystemMessage(content=_SYSTEM_PROMPT)] + messages
        response = await llm_with_tools.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(OrderFulfillmentAgentState)
    graph.add_node("fulfillment_tracker", fulfillment_tracker)
    graph.add_node("tools", tool_node)

    graph.add_edge(START, "fulfillment_tracker")
    graph.add_conditional_edges("fulfillment_tracker", tools_condition)
    graph.add_edge("tools", "fulfillment_tracker")

    return graph.compile()

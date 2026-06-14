"""
Logistics & Dispatch Agent — Phase 9
ReAct loop: dispatch_coordinator ↔ tool_node until no more tool calls.
Model: llama-3.1-8b-instant (llm_flash) — operational dispatch coordination.
Write tool: create_dispatch — creates delivery record + updates order status atomically.
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
from tools.logistics_tools import create_logistics_tools


_SYSTEM_PROMPT = """You are the Logistics & Dispatch Agent for Nexora Distribution Intelligence Platform.
Nexora is a wholesale electronics distributor with 5 Indian branches: Hyderabad, Bangalore, Chennai, Mumbai, Pune.

Your responsibilities:
1. Monitor the dispatch queue — identify orders ready to ship, prioritised by urgency and due date
2. Track active deliveries — flag overdue shipments requiring escalation
3. Assess delivery performance across branches — surface branches with poor on-time rates
4. Coordinate dispatch — assign vehicles, drivers, and routes for pending orders

Priority order for dispatch:
- urgent > high > normal > low
- Within same priority: earliest due_date first, then oldest order first

Route naming convention (use city names):
- Same-city: "Local — {city}"
- Cross-branch: "{from_city} → {to_city} via NH{number}" (use realistic Indian highway numbers)
  - Hyderabad–Bangalore: NH44  |  Hyderabad–Chennai: NH65  |  Hyderabad–Mumbai: NH65/NH48
  - Bangalore–Chennai: NH48    |  Bangalore–Mumbai: NH48   |  Chennai–Mumbai: NH48
  - Hyderabad–Pune: NH65/NH48  |  Bangalore–Pune: NH48

Vehicle numbering format: {StateCode}{DistrictCode}{Letter}{Number} (e.g. TS09AB1234, KA03CD5678)
State codes: Hyderabad=TS, Bangalore=KA, Chennai=TN, Mumbai=MH, Pune=MH

Estimated delivery hours guidelines:
- Same city: 2–4 hours
- Nearby cities (≤500 km): 8–12 hours
- Long distance (>500 km): 18–24 hours

Workflow for a dispatch run:
Step 1 — Call get_delivery_performance to assess overall logistics health
Step 2 — Call get_dispatch_queue to see orders waiting to ship
Step 3 — Call get_active_deliveries to check what is already in transit
Step 4 — For each order in the queue, call create_dispatch with appropriate vehicle/driver/route
Step 5 — Report dispatch summary

Rules:
- Only dispatch orders with status IN ('confirmed', 'processing', 'approved')
- Do NOT dispatch the same order twice — the queue only shows undispatched orders
- Always assign realistic Indian vehicle numbers and route descriptions
- Flag overdue active deliveries for escalation to the Communication Agent

Structure your final response as:
**LOGISTICS HEALTH** — per-branch on-time rates, avg delivery hours, overdue count
**DISPATCH QUEUE** — orders awaiting dispatch with priority and customer details
**ACTIVE DELIVERIES** — in-transit shipments, flag any overdue ones
**DISPATCHED TODAY** — summary of dispatch actions taken this run
**ALERTS** — overdue deliveries or branches with poor on-time rates needing attention
"""


class LogisticsAgentState(TypedDict):
    messages: Annotated[list, add_messages]
    warehouse_id: str | None


def create_logistics_graph(pool: asyncpg.Pool) -> CompiledStateGraph:
    """Build and compile the Logistics & Dispatch Agent ReAct graph.

    Args:
        pool: asyncpg connection pool — passed to tools via closure.

    Returns compiled StateGraph with ReAct loop: dispatch_coordinator → tools → END.
    """
    tools = create_logistics_tools(pool)
    tool_node = ToolNode(tools)
    llm_with_tools = get_llm_flash().bind_tools(tools)

    async def dispatch_coordinator(state: LogisticsAgentState) -> dict:
        messages = state["messages"]
        if not any(isinstance(m, SystemMessage) for m in messages):
            messages = [SystemMessage(content=_SYSTEM_PROMPT)] + messages
        response = await llm_with_tools.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(LogisticsAgentState)
    graph.add_node("dispatch_coordinator", dispatch_coordinator)
    graph.add_node("tools", tool_node)

    graph.add_edge(START, "dispatch_coordinator")
    graph.add_conditional_edges("dispatch_coordinator", tools_condition)
    graph.add_edge("tools", "dispatch_coordinator")

    return graph.compile()

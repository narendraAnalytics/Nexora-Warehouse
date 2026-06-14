"""
Warehouse Transfer Agent — Phase 8
ReAct loop: transfer_planner ↔ tool_node until no more tool calls.
Model: llama-3.1-8b-instant (llm_flash) — operational/mechanical rebalancing task.
Write tool: create_draft_transfer inserts pending transfers; human approval required.
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
from tools.warehouse_transfer_tools import create_warehouse_transfer_tools


_SYSTEM_PROMPT = """You are the Warehouse Transfer Agent for Nexora Distribution Intelligence Platform.
Nexora is a wholesale electronics distributor with 5 Indian branches: Hyderabad, Bangalore, Chennai, Mumbai, Pune.
Product categories: TVs, Mobiles & Tablets, Gaming Consoles, Networking Equipment, Accessories & Peripherals.

Your responsibilities:
1. Assess inventory health across all 5 branches — identify surplus and deficit warehouses
2. Find specific rebalancing opportunities — products overstocked somewhere, understocked elsewhere
3. Check for existing in-flight transfers to avoid duplicating movements
4. Create draft transfer orders for manager approval

Rebalancing criteria:
- TRANSFER eligible: source warehouse quantity > max_stock (has surplus) AND destination quantity < reorder_point (has deficit)
- Transfer quantity = suggested_qty from get_rebalance_candidates (= min of surplus and deficit)
- NEVER transfer if has_open_transfer = true for that product/route combination

Workflow for a full rebalancing run:
Step 1 — Call get_warehouse_inventory_summary to see branch health at a glance
Step 2 — Call get_rebalance_candidates (optionally filter by category) to find transfer pairs
Step 3 — Call get_pending_transfers to check what is already in-flight
Step 4 — For each candidate where has_open_transfer = false, call create_draft_transfer
Step 5 — Report summary of transfers created and overall rebalancing impact

Rules:
- NEVER create a transfer if has_open_transfer = true
- Always use suggested_qty as the transfer quantity — do not invent quantities
- All transfers are drafts — state clearly that manager approval is required before dispatch
- Prioritise branches with highest understocked count and largest deficit products

Structure your final response as:
**BRANCH HEALTH OVERVIEW** — health_pct per branch, highlight worst performers
**REBALANCING OPPORTUNITIES** — surplus → deficit pairs with surplus amount and deficit amount
**IN-FLIGHT TRANSFERS** — existing pending/dispatched transfers (to avoid duplication)
**TRANSFERS CREATED** — list of draft transfers with transfer_number, route, product, qty
**REBALANCING IMPACT** — projected improvement in branch health after transfers complete
**PENDING APPROVAL** — reminder that all transfers require manager approval before dispatch
"""


class WarehouseTransferAgentState(TypedDict):
    messages: Annotated[list, add_messages]
    from_warehouse_id: str | None
    category: str | None


def create_warehouse_transfer_graph(pool: asyncpg.Pool) -> CompiledStateGraph:
    """Build and compile the Warehouse Transfer Agent ReAct graph.

    Args:
        pool: asyncpg connection pool — passed to tools via closure.

    Returns compiled StateGraph with ReAct loop: transfer_planner → tools → END.
    """
    tools = create_warehouse_transfer_tools(pool)
    tool_node = ToolNode(tools)
    llm_with_tools = get_llm_flash().bind_tools(tools)

    async def transfer_planner(state: WarehouseTransferAgentState) -> dict:
        messages = state["messages"]
        if not any(isinstance(m, SystemMessage) for m in messages):
            messages = [SystemMessage(content=_SYSTEM_PROMPT)] + messages
        response = await llm_with_tools.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(WarehouseTransferAgentState)
    graph.add_node("transfer_planner", transfer_planner)
    graph.add_node("tools", tool_node)

    graph.add_edge(START, "transfer_planner")
    graph.add_conditional_edges("transfer_planner", tools_condition)
    graph.add_edge("tools", "transfer_planner")

    return graph.compile()

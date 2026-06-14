"""
Inventory Intelligence Agent — Phase 4
ReAct loop: inventory_analyst ↔ tool_node until no more tool calls.
Model: llama-3.1-8b-instant (llm_flash) per github.txt agent assignment.
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
from tools.inventory_tools import create_inventory_tools


_SYSTEM_PROMPT = """You are the Inventory Intelligence Agent for Nexora Distribution Intelligence Platform.
Nexora is a wholesale electronics distributor with 5 Indian branches: Hyderabad, Bangalore, Chennai, Mumbai, Pune.

Your responsibilities:
1. Monitor stock levels across warehouses
2. Detect products needing reorder (quantity at or below reorder_point)
3. Identify overstocked products (quantity at or above max_stock)
4. Suggest cross-warehouse transfers to balance inventory

Always call the relevant tools first to gather live data before producing recommendations.

Structure your final response as:
**REORDER ALERTS** — items below reorder point, recommended order quantities
**OVERSTOCK ALERTS** — items over max stock, storage risk
**TRANSFER OPPORTUNITIES** — cross-branch moves to balance stock
**SUMMARY** — overall inventory health and top 3 priority actions
"""


class InventoryAgentState(TypedDict):
    messages: Annotated[list, add_messages]
    warehouse_id: str | None


def create_inventory_graph(pool: asyncpg.Pool) -> CompiledStateGraph:
    """Build and compile the Inventory Intelligence ReAct graph.

    Args:
        pool: asyncpg connection pool — passed to tools via closure.

    Returns compiled StateGraph with ReAct loop: analyst → tools → analyst → END.
    """
    tools = create_inventory_tools(pool)
    tool_node = ToolNode(tools)
    llm_with_tools = get_llm_flash().bind_tools(tools)

    async def inventory_analyst(state: InventoryAgentState) -> dict:
        messages = state["messages"]
        if not any(isinstance(m, SystemMessage) for m in messages):
            messages = [SystemMessage(content=_SYSTEM_PROMPT)] + messages
        response = await llm_with_tools.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(InventoryAgentState)
    graph.add_node("inventory_analyst", inventory_analyst)
    graph.add_node("tools", tool_node)

    graph.add_edge(START, "inventory_analyst")
    graph.add_conditional_edges("inventory_analyst", tools_condition)
    graph.add_edge("tools", "inventory_analyst")

    return graph.compile()

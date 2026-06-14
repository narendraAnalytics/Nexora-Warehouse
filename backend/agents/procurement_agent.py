"""
Procurement Agent — Phase 6
ReAct loop: procurement_analyst ↔ tool_node until no more tool calls.
Model: llama-3.3-70b-versatile (llm_pro) per github.txt agent assignment.
Write tool: create_draft_po — inserts draft POs, human approval required.
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
from tools.procurement_tools import create_procurement_tools


_SYSTEM_PROMPT = """You are the Procurement Agent for Nexora Distribution Intelligence Platform.
Nexora is a wholesale electronics distributor with 5 Indian branches: Hyderabad, Bangalore, Chennai, Mumbai, Pune.
Product categories: TVs, Mobiles & Tablets, Gaming Consoles, Networking Equipment, Accessories & Peripherals.

Your responsibilities:
1. Identify products that need reordering (below reorder_point)
2. Check for existing open POs to avoid duplicate orders
3. Select the best supplier for each product category — highest reliability_score, lowest risk_score, shortest lead time
4. Create draft purchase orders with clear AI reasoning
5. Summarise total procurement cost and expected delivery timeline

Workflow for each procurement run:
Step 1 — Call get_reorder_candidates to find what needs ordering
Step 2 — Call get_open_purchase_orders to check existing drafts (skip products already covered)
Step 3 — For each uncovered product, call get_suppliers_for_category to find best supplier
Step 4 — Call create_draft_po for each product needing a new PO
Step 5 — Report summary

Rules:
- NEVER create a PO if has_open_po = true for that product
- Always include a specific ai_reasoning explaining WHY this product needs ordering
- All POs are drafts — state clearly that human approval is required before execution
- Use reorder_qty from get_reorder_candidates as the order quantity

Structure your final response as:
**REORDER NEEDS** — products below reorder point and their deficit
**SUPPLIER SELECTION** — chosen supplier per category with rationale (reliability/risk/lead time)
**POs CREATED** — list of draft POs with po_number, product, quantity, cost, expected date
**COST SUMMARY** — total procurement value and average lead time
**PENDING APPROVAL** — reminder that all POs require manager approval
"""


class ProcurementAgentState(TypedDict):
    messages: Annotated[list, add_messages]
    warehouse_id: str | None
    category: str | None


def create_procurement_graph(pool: asyncpg.Pool) -> CompiledStateGraph:
    """Build and compile the Procurement Agent ReAct graph.

    Args:
        pool: asyncpg connection pool — passed to tools via closure.

    Returns compiled StateGraph with ReAct loop: procurement_analyst → tools → END.
    """
    tools = create_procurement_tools(pool)
    tool_node = ToolNode(tools)
    llm_with_tools = get_llm_pro().bind_tools(tools)

    async def procurement_analyst(state: ProcurementAgentState) -> dict:
        messages = state["messages"]
        if not any(isinstance(m, SystemMessage) for m in messages):
            messages = [SystemMessage(content=_SYSTEM_PROMPT)] + messages
        response = await llm_with_tools.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(ProcurementAgentState)
    graph.add_node("procurement_analyst", procurement_analyst)
    graph.add_node("tools", tool_node)

    graph.add_edge(START, "procurement_analyst")
    graph.add_conditional_edges("procurement_analyst", tools_condition)
    graph.add_edge("tools", "procurement_analyst")

    return graph.compile()

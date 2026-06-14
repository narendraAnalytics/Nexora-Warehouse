"""
Supplier Risk Agent — Phase 7
ReAct loop: risk_analyst ↔ tool_node until no more tool calls.
Model: llama-3.3-70b-versatile (llm_pro) — risk intelligence requires deeper reasoning.
Read-only: identifies risk, recommends alternatives; does NOT create POs.
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
from tools.supplier_risk_tools import create_supplier_risk_tools


_SYSTEM_PROMPT = """You are the Supplier Risk Agent for Nexora Distribution Intelligence Platform.
Nexora is a wholesale electronics distributor with 5 Indian branches: Hyderabad, Bangalore, Chennai, Mumbai, Pune.
Product categories: TVs, Mobiles & Tablets, Gaming Consoles, Networking Equipment, Accessories & Peripherals.

Your responsibilities:
1. Assess supplier risk across the entire supplier base — identify high-risk, unreliable suppliers
2. Detect overdue purchase orders — surface suppliers who are actively causing delivery delays
3. Analyse individual supplier performance — on-time rate, average delay, pending value at risk
4. Recommend alternative suppliers when a supplier is risky or underperforming

Risk scoring (risk_score 1–10, higher = riskier):
- CRITICAL RISK: risk_score >= 7.5 OR on_time_rate < 60% OR overdue POs > 2
- HIGH RISK: risk_score 5.0–7.4 OR on_time_rate 60–75%
- MEDIUM RISK: risk_score 3.0–4.9 OR on_time_rate 75–85%
- LOW RISK: risk_score < 3.0 AND on_time_rate >= 85%

Recommended workflow for a full risk assessment:
Step 1 — Call get_supplier_risk_scores to see all suppliers ranked by risk
Step 2 — Call get_overdue_purchase_orders to find active delivery failures
Step 3 — For suppliers flagged CRITICAL or HIGH, call get_supplier_po_performance for deep analysis
Step 4 — For each high-risk supplier with active categories, call get_alternative_suppliers
Step 5 — Report structured risk assessment with recommended actions

Rules:
- This agent is READ-ONLY — do not attempt to create POs or modify supplier records
- Always cross-reference risk_score AND on_time_rate AND overdue_pos before classifying risk
- Quantify financial exposure: overdue POs × total_amount = capital at risk
- Provide specific, actionable recommendations (e.g. "switch category X to supplier Y")

Structure your final response as:
**RISK OVERVIEW** — total suppliers assessed, breakdown by risk tier
**ACTIVE DELIVERY FAILURES** — overdue POs with capital at risk and days overdue
**CRITICAL/HIGH RISK SUPPLIERS** — deep analysis per supplier with on-time rates and pending value
**ALTERNATIVE SUPPLIERS** — recommended replacements per category with reliability comparison
**RECOMMENDED ACTIONS** — prioritised list (immediate / this week / this month)
"""


class SupplierRiskAgentState(TypedDict):
    messages: Annotated[list, add_messages]
    supplier_id: str | None
    category: str | None


def create_supplier_risk_graph(pool: asyncpg.Pool) -> CompiledStateGraph:
    """Build and compile the Supplier Risk Agent ReAct graph.

    Args:
        pool: asyncpg connection pool — passed to tools via closure.

    Returns compiled StateGraph with ReAct loop: risk_analyst → tools → END.
    """
    tools = create_supplier_risk_tools(pool)
    tool_node = ToolNode(tools)
    llm_with_tools = get_llm_pro().bind_tools(tools)

    async def risk_analyst(state: SupplierRiskAgentState) -> dict:
        messages = state["messages"]
        if not any(isinstance(m, SystemMessage) for m in messages):
            messages = [SystemMessage(content=_SYSTEM_PROMPT)] + messages
        response = await llm_with_tools.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(SupplierRiskAgentState)
    graph.add_node("risk_analyst", risk_analyst)
    graph.add_node("tools", tool_node)

    graph.add_edge(START, "risk_analyst")
    graph.add_conditional_edges("risk_analyst", tools_condition)
    graph.add_edge("tools", "risk_analyst")

    return graph.compile()

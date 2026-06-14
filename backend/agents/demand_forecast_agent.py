"""
Demand Forecast Agent — Phase 5
ReAct loop: demand_analyst ↔ tool_node until no more tool calls.
Model: llama-3.3-70b-versatile (llm_pro) per github.txt agent assignment.
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
from tools.demand_forecast_tools import create_demand_forecast_tools


_SYSTEM_PROMPT = """You are the Demand Forecast Agent for Nexora Distribution Intelligence Platform.
Nexora is a wholesale electronics distributor with 5 Indian branches: Hyderabad, Bangalore, Chennai, Mumbai, Pune.
Product categories: TVs, Mobiles & Tablets, Gaming Consoles, Networking Equipment, Accessories & Peripherals.

Your responsibilities:
1. Analyse demand velocity — identify fast movers and slow movers across warehouses
2. Detect stockout risk — products with less than 7 days of stock at current demand rates
3. Flag dead stock risk — products with more than 90 days of supply or zero demand (capital locked)
4. Compare demand across branches for a category — surface imbalances for rebalancing decisions

Thresholds:
- CRITICAL: < 7 days of stock remaining
- LOW: 7–30 days remaining
- HEALTHY: 30–90 days remaining
- EXCESS: > 90 days remaining or zero demand

Always call tools first to gather live data before producing analysis.

Structure your final response as:
**DEMAND VELOCITY** — top fast movers and their daily demand rates
**STOCKOUT RISK** — products at critical/low stock with urgency ranking and 30-day units needed
**SLOW MOVERS / DEAD STOCK** — excess inventory with capital locked estimate
**CROSS-BRANCH INSIGHTS** — demand imbalances across branches (if category comparison run)
**FORECAST SUMMARY** — overall demand health, top 3 recommended actions for procurement/inventory
"""


class DemandForecastAgentState(TypedDict):
    messages: Annotated[list, add_messages]
    warehouse_id: str | None
    category: str | None


def create_demand_forecast_graph(pool: asyncpg.Pool) -> CompiledStateGraph:
    """Build and compile the Demand Forecast ReAct graph.

    Args:
        pool: asyncpg connection pool — passed to tools via closure.

    Returns compiled StateGraph with ReAct loop: demand_analyst → tools → demand_analyst → END.
    """
    tools = create_demand_forecast_tools(pool)
    tool_node = ToolNode(tools)
    llm_with_tools = get_llm_pro().bind_tools(tools)

    async def demand_analyst(state: DemandForecastAgentState) -> dict:
        messages = state["messages"]
        if not any(isinstance(m, SystemMessage) for m in messages):
            messages = [SystemMessage(content=_SYSTEM_PROMPT)] + messages
        response = await llm_with_tools.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(DemandForecastAgentState)
    graph.add_node("demand_analyst", demand_analyst)
    graph.add_node("tools", tool_node)

    graph.add_edge(START, "demand_analyst")
    graph.add_conditional_edges("demand_analyst", tools_condition)
    graph.add_edge("tools", "demand_analyst")

    return graph.compile()

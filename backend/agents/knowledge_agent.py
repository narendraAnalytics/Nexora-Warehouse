"""
Knowledge & RAG Agent — LangGraph ReAct agent that retrieves and synthesises
information from the Nexora knowledge base (SOPs, supplier policies, logistics
rules, executive decisions) using pgvector or ChromaDB similarity search.
"""
from typing import Annotated

import asyncpg
from langchain_core.messages import SystemMessage
from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from typing_extensions import TypedDict

from llm_factory import get_llm_pro
from tools.knowledge_tools import create_knowledge_tools

_SYSTEM_PROMPT = """You are the Knowledge & RAG Agent for Nexora Distribution Intelligence Platform.

You have access to Nexora's internal knowledge base, organised into four layers:
- **business** — SOPs, operational policies, workflows
- **supplier** — contracts, SLAs, pricing agreements
- **logistics** — shipping rules, delivery zones, routes
- **executive** — past CEO decisions, strategy, KPI benchmarks

## How to Answer

1. **Select the right layer(s).** Match the user's question to the most relevant layer.
   For cross-domain questions, search multiple layers and synthesise.

2. **Search and retrieve.** Call the appropriate tool(s) with a clear, specific query.
   If the first search returns low-scoring results (score < 0.5), try a rephrased query.

3. **Synthesise a cited answer.** Build your response from the retrieved chunks.
   Always cite the source: (doc_id: X, score: Y).

4. **Flag gaps.** If no relevant chunks are found (empty results or all score < 0.3),
   say so clearly — do not fabricate policy details.

## Response Format

**Answer:** [Direct answer based on retrieved content]

**Sources:**
- [doc_id] — score: X.XX — "[brief excerpt]"

**Confidence:** HIGH (score > 0.7) | MEDIUM (0.4–0.7) | LOW (< 0.4)

**Note:** [Any gaps, caveats, or suggestions to update the knowledge base]
"""


class KnowledgeAgentState(TypedDict):
    messages: Annotated[list, add_messages]
    layer: str | None


def create_knowledge_graph(pool: asyncpg.Pool):
    """Return compiled Knowledge & RAG Agent LangGraph."""
    tools = create_knowledge_tools(pool)
    tool_node = ToolNode(tools)
    llm_with_tools = get_llm_pro().bind_tools(tools)

    async def knowledge_analyst(state: KnowledgeAgentState) -> dict:
        messages = state["messages"]
        if not any(isinstance(m, SystemMessage) for m in messages):
            messages = [SystemMessage(content=_SYSTEM_PROMPT)] + messages
        response = await llm_with_tools.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(KnowledgeAgentState)
    graph.add_node("knowledge_analyst", knowledge_analyst)
    graph.add_node("tools", tool_node)

    graph.add_edge(START, "knowledge_analyst")
    graph.add_conditional_edges("knowledge_analyst", tools_condition)
    graph.add_edge("tools", "knowledge_analyst")

    return graph.compile()

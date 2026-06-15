"""
Knowledge & RAG tools — async @tool functions wrapping NexoraRetriever.
Pool injected via closure; retriever is a singleton via get_retriever().
Each tool searches one knowledge layer and returns ranked chunks.
"""
import json

import asyncpg
from langchain_core.tools import tool

from rag.retriever import get_retriever


def create_knowledge_tools(pool: asyncpg.Pool) -> list:
    """Return the 4 knowledge retrieval tools with pool captured in closure."""

    retriever = get_retriever()

    @tool
    async def search_business_knowledge(query: str) -> str:
        """Search Nexora's business knowledge base — SOPs, operational policies, and internal workflows.

        Use this to answer questions about:
        - Standard operating procedures for warehouse operations
        - Inventory management policies and thresholds
        - Procurement approval workflows
        - Quality control and compliance guidelines
        - Employee roles and responsibilities

        Args:
            query: Natural language question about business operations or policies.

        Returns JSON with a list of relevant document chunks ranked by similarity score.
        """
        try:
            results = await retriever.search(pool, query, layer="business", limit=5)
            return json.dumps({
                "layer": "business",
                "query": query,
                "results": results,
                "count": len(results),
            })
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def search_supplier_knowledge(query: str) -> str:
        """Search Nexora's supplier knowledge base — contracts, SLAs, and pricing agreements.

        Use this to answer questions about:
        - Supplier contract terms and conditions
        - Service level agreements (lead times, penalties)
        - Pricing agreements and discount structures
        - Preferred supplier policies by product category
        - Supplier onboarding and evaluation criteria

        Args:
            query: Natural language question about supplier policies or agreements.

        Returns JSON with a list of relevant document chunks ranked by similarity score.
        """
        try:
            results = await retriever.search(pool, query, layer="supplier", limit=5)
            return json.dumps({
                "layer": "supplier",
                "query": query,
                "results": results,
                "count": len(results),
            })
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def search_logistics_knowledge(query: str) -> str:
        """Search Nexora's logistics knowledge base — shipping rules, delivery zones, and routes.

        Use this to answer questions about:
        - Delivery zones and serviceable pincodes per warehouse
        - Standard shipping routes between branches (NH44, NH65, NH48, etc.)
        - ETA guidelines for inter-city deliveries
        - Carrier selection rules and fallback options
        - Packaging and handling requirements by product category

        Args:
            query: Natural language question about logistics, shipping, or delivery.

        Returns JSON with a list of relevant document chunks ranked by similarity score.
        """
        try:
            results = await retriever.search(pool, query, layer="logistics", limit=5)
            return json.dumps({
                "layer": "logistics",
                "query": query,
                "results": results,
                "count": len(results),
            })
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def search_executive_knowledge(query: str) -> str:
        """Search Nexora's executive knowledge base — historical decisions, strategy, and KPI benchmarks.

        Use this to answer questions about:
        - Past CEO decisions and their outcomes
        - Strategic priorities and growth targets
        - KPI benchmarks (target margins, stockout rates, fulfillment SLAs)
        - Lessons learned from past incidents or crises
        - Board-level policies and directives

        Args:
            query: Natural language question about strategy, past decisions, or KPI targets.

        Returns JSON with a list of relevant document chunks ranked by similarity score.
        """
        try:
            results = await retriever.search(pool, query, layer="executive", limit=5)
            return json.dumps({
                "layer": "executive",
                "query": query,
                "results": results,
                "count": len(results),
            })
        except Exception as e:
            return json.dumps({"error": str(e)})

    return [
        search_business_knowledge,
        search_supplier_knowledge,
        search_logistics_knowledge,
        search_executive_knowledge,
    ]

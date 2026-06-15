from fastapi import APIRouter, HTTPException, Request
from langchain_core.messages import HumanMessage

from schemas.knowledge import KnowledgeQueryRequest, KnowledgeQueryResponse

router = APIRouter()


@router.post("/query", response_model=KnowledgeQueryResponse, tags=["Knowledge"])
async def knowledge_query(body: KnowledgeQueryRequest, request: Request):
    """Search the Nexora knowledge base with a natural language query.

    Optionally scope to a specific layer: business | supplier | logistics | executive.
    The agent searches relevant document chunks and synthesises a cited answer.
    """
    graph = request.app.state.knowledge_graph
    try:
        result = await graph.ainvoke({
            "messages": [HumanMessage(content=body.query)],
            "layer": body.layer,
        })
        return KnowledgeQueryResponse(
            response=result["messages"][-1].content,
            layer=body.layer,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

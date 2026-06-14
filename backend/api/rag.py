from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field

from rag.pipeline import ingest_document
from rag.retriever import get_retriever

router = APIRouter()

VALID_LAYERS = {"business", "supplier", "logistics", "executive"}


class IngestRequest(BaseModel):
    text: str = Field(..., min_length=10)
    doc_id: str = Field(..., min_length=1)
    layer: str = Field(..., pattern="^(business|supplier|logistics|executive)$")
    source: str = Field(default="markdown", pattern="^(markdown|text)$")


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=2)
    layer: str | None = Field(default=None, pattern="^(business|supplier|logistics|executive)$")
    limit: int = Field(default=5, ge=1, le=20)
    threshold: float = Field(default=0.0, ge=0.0, le=1.0)


@router.post("/ingest", tags=["RAG"])
async def ingest(body: IngestRequest, request: Request):
    pool = request.app.state.pool
    try:
        count = await ingest_document(
            pool,
            text=body.text,
            doc_id=body.doc_id,
            layer=body.layer,
            source=body.source,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"doc_id": body.doc_id, "layer": body.layer, "chunks_ingested": count}


@router.post("/search", tags=["RAG"])
async def search(body: SearchRequest, request: Request):
    pool = request.app.state.pool
    retriever = get_retriever()
    try:
        results = await retriever.search(
            pool,
            query=body.query,
            layer=body.layer,
            limit=body.limit,
            threshold=body.threshold,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"query": body.query, "layer": body.layer, "results": results}


@router.get("/status", tags=["RAG"])
async def rag_status(request: Request):
    """Return chunk counts per knowledge layer."""
    pool = request.app.state.pool
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT knowledge_layer, COUNT(*) as count FROM document_chunks GROUP BY knowledge_layer"
            )
        layer_counts = {row["knowledge_layer"]: row["count"] for row in rows}
        total = sum(layer_counts.values())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"total_chunks": total, "by_layer": layer_counts}

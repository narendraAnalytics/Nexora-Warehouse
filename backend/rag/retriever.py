"""
NexoraRetriever — unified retrieval interface.
RAG_BACKEND=pgvector → embed query → pgvector cosine search
RAG_BACKEND=chroma   → ChromaDB built-in embedding + search
"""
import asyncpg
from config import settings
from rag.embedder import embed_query
from rag.pgvector_store import similarity_search as pg_search
from rag.chroma_store import ChromaStore

_retriever: "NexoraRetriever | None" = None


class NexoraRetriever:
    def __init__(self):
        self._chroma: ChromaStore | None = None

    async def search(
        self,
        pool: asyncpg.Pool,
        query: str,
        layer: str | None = None,
        limit: int = 5,
        threshold: float = 0.0,
    ) -> list[dict]:
        if settings.RAG_BACKEND == "chroma":
            if self._chroma is None:
                self._chroma = ChromaStore()
            return self._chroma.similarity_search(query, layer=layer, limit=limit)

        # pgvector path
        embedding = embed_query(query)
        return await pg_search(pool, embedding, layer=layer, limit=limit, threshold=threshold)


def get_retriever() -> NexoraRetriever:
    global _retriever
    if _retriever is None:
        _retriever = NexoraRetriever()
    return _retriever

"""
RAG ingest pipeline: text → chunks → embeddings → store.
Supports both pgvector and ChromaDB backends.
"""
import asyncpg
from config import settings
from rag.chunker import chunk_by_heading, chunk_text
from rag.embedder import embed_documents
from rag.pgvector_store import insert_chunks as pg_insert
from rag.chroma_store import ChromaStore


async def ingest_document(
    pool: asyncpg.Pool,
    text: str,
    doc_id: str,
    layer: str,
    source: str = "markdown",  # markdown | text
) -> int:
    """
    Chunk → embed → store. Returns number of chunks inserted.
    source="markdown" uses heading-based chunking.
    source="text" uses sliding-window chunking.
    """
    if source == "markdown":
        chunks = chunk_by_heading(text, doc_id, layer)
    else:
        chunks = chunk_text(text, doc_id, layer)

    if not chunks:
        return 0

    if settings.RAG_BACKEND == "chroma":
        store = ChromaStore()
        return store.upsert_chunks(chunks)

    # pgvector path — embed all chunks then batch-insert
    texts = [c["content"] for c in chunks]
    embeddings = embed_documents(texts)
    return await pg_insert(pool, chunks, embeddings)


async def ingest_file(
    pool: asyncpg.Pool,
    file_path: str,
    doc_id: str,
    layer: str,
) -> int:
    """Convenience wrapper: read a .md file and ingest it."""
    with open(file_path, encoding="utf-8") as f:
        text = f.read()
    return await ingest_document(pool, text, doc_id, layer, source="markdown")

"""
pgvector store — async insert and cosine similarity search via asyncpg.
Embeddings must be pre-computed (384 dims, all-MiniLM-L6-v2).
"""
import json
import asyncpg


async def insert_chunks(
    pool: asyncpg.Pool,
    chunks: list[dict],
    embeddings: list[list[float]],
) -> int:
    """Batch-insert chunks with their embeddings. Skips duplicates (doc_id, chunk_index)."""
    inserted = 0
    async with pool.acquire() as conn:
        for chunk, embedding in zip(chunks, embeddings):
            result = await conn.execute(
                """
                INSERT INTO document_chunks
                    (doc_id, knowledge_layer, chunk_index, content, metadata, embedding)
                VALUES ($1, $2, $3, $4, $5, $6::VECTOR)
                ON CONFLICT (doc_id, chunk_index) DO NOTHING
                """,
                chunk["doc_id"],
                chunk["knowledge_layer"],
                chunk["chunk_index"],
                chunk["content"],
                json.dumps(chunk.get("metadata", {})),
                "[" + ",".join(str(float(v)) for v in embedding) + "]",
            )
            if result == "INSERT 0 1":
                inserted += 1
    return inserted


async def similarity_search(
    pool: asyncpg.Pool,
    query_embedding: list[float],
    layer: str | None = None,
    limit: int = 5,
    threshold: float = 0.0,
) -> list[dict]:
    """Return top-k chunks by cosine similarity. Layer filter is optional."""
    async with pool.acquire() as conn:
        if layer:
            rows = await conn.fetch(
                """
                SELECT doc_id, knowledge_layer, chunk_index, content, metadata,
                       1 - (embedding <=> $1::VECTOR) AS score
                FROM document_chunks
                WHERE knowledge_layer = $2
                  AND 1 - (embedding <=> $1::VECTOR) >= $3
                ORDER BY embedding <=> $1::VECTOR
                LIMIT $4
                """,
                "[" + ",".join(str(float(v)) for v in query_embedding) + "]",
                layer,
                threshold,
                limit,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT doc_id, knowledge_layer, chunk_index, content, metadata,
                       1 - (embedding <=> $1::VECTOR) AS score
                FROM document_chunks
                WHERE 1 - (embedding <=> $1::VECTOR) >= $2
                ORDER BY embedding <=> $1::VECTOR
                LIMIT $3
                """,
                "[" + ",".join(str(float(v)) for v in query_embedding) + "]",
                threshold,
                limit,
            )

    return [
        {
            "content": row["content"],
            "doc_id": row["doc_id"],
            "layer": row["knowledge_layer"],
            "chunk_index": row["chunk_index"],
            "score": float(row["score"]),
            "metadata": row["metadata"] if isinstance(row["metadata"], dict) else json.loads(row["metadata"] or "{}"),
        }
        for row in rows
    ]


async def delete_document(pool: asyncpg.Pool, doc_id: str) -> int:
    """Remove all chunks for a document. Returns deleted count."""
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM document_chunks WHERE doc_id = $1", doc_id
        )
    return int(result.split()[-1])

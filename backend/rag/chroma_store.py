"""
ChromaDB store — local dev / Render deployment alternative.
Uses ChromaDB's built-in all-MiniLM-L6-v2 (no embedding_function= arg needed).
Collections are per-layer: nexora_business, nexora_supplier, etc.
"""
from typing import Any
import chromadb
from config import settings

_client: Any = None

VALID_LAYERS = {"business", "supplier", "logistics", "executive"}


def _get_client() -> chromadb.Client:
    global _client
    if _client is None:
        if settings.CHROMA_MODE == "server":
            _client = chromadb.HttpClient(
                host=settings.CHROMA_HOST,
                port=settings.CHROMA_PORT,
            )
        else:
            _client = chromadb.PersistentClient(path="./chroma_data")
    return _client


def _collection_name(layer: str) -> str:
    return f"nexora_{layer}"


class ChromaStore:
    def __init__(self):
        self._client = _get_client()

    def _get_or_create(self, layer: str):
        return self._client.get_or_create_collection(
            name=_collection_name(layer),
            metadata={"hnsw:space": "cosine"},
            # No embedding_function= → uses DefaultEmbeddingFunction (all-MiniLM-L6-v2)
        )

    def upsert_chunks(self, chunks: list[dict]) -> int:
        by_layer: dict[str, list[dict]] = {}
        for chunk in chunks:
            by_layer.setdefault(chunk["knowledge_layer"], []).append(chunk)

        total = 0
        for layer, layer_chunks in by_layer.items():
            collection = self._get_or_create(layer)
            collection.upsert(
                ids=[f"{c['doc_id']}__{c['chunk_index']}" for c in layer_chunks],
                documents=[c["content"] for c in layer_chunks],
                metadatas=[c.get("metadata", {}) for c in layer_chunks],
            )
            total += len(layer_chunks)
        return total

    def similarity_search(
        self,
        query_text: str,
        layer: str | None = None,
        limit: int = 5,
    ) -> list[dict]:
        layers_to_search = [layer] if layer else list(VALID_LAYERS)
        results = []

        for lyr in layers_to_search:
            try:
                collection = self._client.get_collection(_collection_name(lyr))
            except Exception:
                continue

            count = collection.count()
            if count == 0:
                continue

            n = min(limit, count)
            res = collection.query(query_texts=[query_text], n_results=n)
            docs = res["documents"][0]
            distances = res["distances"][0]
            metas = res["metadatas"][0]

            for doc, dist, meta in zip(docs, distances, metas):
                results.append({
                    "content": doc,
                    "doc_id": meta.get("doc_id", ""),
                    "layer": lyr,
                    "chunk_index": meta.get("chunk_index", 0),
                    "score": round(1 - dist, 4),  # ChromaDB cosine → convert distance to similarity
                    "metadata": meta,
                })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]

    def delete_document(self, doc_id: str) -> None:
        for layer in VALID_LAYERS:
            try:
                collection = self._client.get_collection(_collection_name(layer))
                all_ids = collection.get()["ids"]
                to_delete = [i for i in all_ids if i.startswith(f"{doc_id}__")]
                if to_delete:
                    collection.delete(ids=to_delete)
            except Exception:
                continue

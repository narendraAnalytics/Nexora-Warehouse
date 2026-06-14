"""
Embedder using ChromaDB's built-in all-MiniLM-L6-v2 via ONNX runtime.
No API key required. onnxruntime is already a chromadb dependency.
Model weights are downloaded once and cached locally.
"""
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

_ef: DefaultEmbeddingFunction | None = None


def get_embedding_function() -> DefaultEmbeddingFunction:
    global _ef
    if _ef is None:
        _ef = DefaultEmbeddingFunction()
    return _ef


def embed_documents(texts: list[str]) -> list[list[float]]:
    results = get_embedding_function()(texts)
    return [[float(v) for v in row] for row in results]


def embed_query(text: str) -> list[float]:
    results = get_embedding_function()([text])
    return [float(v) for v in results[0]]

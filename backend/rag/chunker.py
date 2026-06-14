import re


def chunk_by_heading(
    text: str,
    doc_id: str,
    layer: str,
    max_size: int = 800,
) -> list[dict]:
    """Split markdown text on heading boundaries."""
    parts = re.split(r"\n(?=#{1,3} )", text.strip())
    chunks = []
    for i, part in enumerate(parts):
        part = part.strip()
        if not part:
            continue
        # If a single heading section is too long, sub-split by blank line
        if len(part) > max_size:
            sub_parts = [p.strip() for p in part.split("\n\n") if p.strip()]
            for j, sub in enumerate(sub_parts):
                chunks.append(_make_chunk(doc_id, layer, len(chunks), sub))
        else:
            chunks.append(_make_chunk(doc_id, layer, len(chunks), part))
    return chunks


def chunk_text(
    text: str,
    doc_id: str,
    layer: str,
    size: int = 800,
    overlap: int = 100,
) -> list[dict]:
    """Sliding-window chunker for plain text / PDF content."""
    text = text.strip()
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunks.append(_make_chunk(doc_id, layer, len(chunks), text[start:end]))
        if end == len(text):
            break
        start = end - overlap
    return chunks


def _make_chunk(doc_id: str, layer: str, index: int, content: str) -> dict:
    return {
        "doc_id": doc_id,
        "knowledge_layer": layer,
        "chunk_index": index,
        "content": content,
        "metadata": {"doc_id": doc_id, "layer": layer, "chunk_index": index},
    }

"""
Seed the RAG knowledge base from the 4 markdown documents.
Run during Render build step: uv run python -m rag.seed
Also called at startup if the DB is empty.
Idempotent — uses ON CONFLICT DO NOTHING on (doc_id, chunk_index).
"""
import asyncio
from pathlib import Path

DOCS_DIR = Path(__file__).parent / "documents"

SEED_MANIFEST = [
    ("business_sop.md",       "nexora_business_sop_v1",     "business"),
    ("supplier_policies.md",  "nexora_supplier_policy_v1",  "supplier"),
    ("logistics_rules.md",    "nexora_logistics_rules_v1",  "logistics"),
    ("executive_knowledge.md","nexora_executive_kb_v1",     "executive"),
]


async def seed_all(pool) -> dict[str, int]:
    from rag.pipeline import ingest_document

    results = {}
    for filename, doc_id, layer in SEED_MANIFEST:
        filepath = DOCS_DIR / filename
        if not filepath.exists():
            print(f"  SKIP  {filename} (not found)")
            results[doc_id] = 0
            continue
        text = filepath.read_text(encoding="utf-8")
        count = await ingest_document(pool, text, doc_id, layer, source="markdown")
        print(f"  OK    {filename} -> {count} chunks ({layer})")
        results[doc_id] = count
    return results


if __name__ == "__main__":
    import sys, os
    sys.path.insert(0, str(Path(__file__).parent.parent))

    async def main():
        import asyncpg
        from config import settings
        pool = await asyncpg.create_pool(settings.NEON_DB_URL, min_size=1, max_size=3)
        print("Seeding Nexora RAG knowledge base...")
        results = await seed_all(pool)
        total = sum(results.values())
        print(f"Done. {total} total chunks inserted.")
        await pool.close()

    asyncio.run(main())

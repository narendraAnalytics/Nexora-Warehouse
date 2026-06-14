"""
Run CREATE TABLE IF NOT EXISTS for all 12 Nexora tables on startup.
Safe to call multiple times — idempotent.
"""
import asyncpg


async def init_db(pool: asyncpg.Pool) -> None:
    async with pool.acquire() as conn:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS document_chunks (
                id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                doc_id          TEXT NOT NULL,
                knowledge_layer TEXT NOT NULL,
                chunk_index     INTEGER NOT NULL,
                content         TEXT NOT NULL,
                metadata        JSONB DEFAULT '{}',
                embedding       VECTOR(384),
                created_at      TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (doc_id, chunk_index)
            )
        """)

        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chunks_embedding
                ON document_chunks USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100)
        """)

        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chunks_layer
                ON document_chunks (knowledge_layer)
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS warehouses (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name        TEXT NOT NULL UNIQUE,
                city        TEXT NOT NULL,
                address     TEXT,
                manager     TEXT,
                phone       TEXT,
                is_active   BOOLEAN DEFAULT TRUE,
                created_at  TIMESTAMPTZ DEFAULT NOW(),
                updated_at  TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                sku             TEXT NOT NULL UNIQUE,
                name            TEXT NOT NULL,
                category        TEXT NOT NULL,
                brand           TEXT,
                description     TEXT,
                unit_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
                unit_cost       NUMERIC(12,2) NOT NULL DEFAULT 0,
                unit_of_measure TEXT DEFAULT 'piece',
                weight_kg       NUMERIC(8,3),
                is_active       BOOLEAN DEFAULT TRUE,
                created_at      TIMESTAMPTZ DEFAULT NOW(),
                updated_at      TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                clerk_id     TEXT UNIQUE,
                email        TEXT NOT NULL UNIQUE,
                full_name    TEXT,
                role         TEXT NOT NULL DEFAULT 'operations',
                warehouse_id UUID REFERENCES warehouses(id),
                is_active    BOOLEAN DEFAULT TRUE,
                created_at   TIMESTAMPTZ DEFAULT NOW(),
                updated_at   TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS suppliers (
                id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name              TEXT NOT NULL,
                contact_person    TEXT,
                email             TEXT,
                phone             TEXT,
                address           TEXT,
                city              TEXT,
                categories        TEXT[],
                risk_score        NUMERIC(4,2) DEFAULT 5.0,
                reliability_score NUMERIC(4,2) DEFAULT 5.0,
                avg_lead_days     INTEGER DEFAULT 7,
                payment_terms     TEXT DEFAULT 'NET30',
                is_active         BOOLEAN DEFAULT TRUE,
                created_at        TIMESTAMPTZ DEFAULT NOW(),
                updated_at        TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS inventory (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
                product_id      UUID NOT NULL REFERENCES products(id),
                quantity        INTEGER NOT NULL DEFAULT 0,
                reserved_qty    INTEGER NOT NULL DEFAULT 0,
                reorder_point   INTEGER NOT NULL DEFAULT 0,
                reorder_qty     INTEGER NOT NULL DEFAULT 0,
                max_stock       INTEGER NOT NULL DEFAULT 0,
                avg_daily_sales NUMERIC(10,2) DEFAULT 0,
                last_counted_at TIMESTAMPTZ,
                created_at      TIMESTAMPTZ DEFAULT NOW(),
                updated_at      TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (warehouse_id, product_id)
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                order_number   TEXT NOT NULL UNIQUE,
                customer_name  TEXT NOT NULL,
                customer_email TEXT,
                customer_phone TEXT,
                warehouse_id   UUID REFERENCES warehouses(id),
                user_id        UUID REFERENCES users(id),
                status         TEXT NOT NULL DEFAULT 'pending',
                priority       TEXT DEFAULT 'normal',
                total_amount   NUMERIC(14,2) DEFAULT 0,
                notes          TEXT,
                due_date       DATE,
                fulfilled_at   TIMESTAMPTZ,
                created_at     TIMESTAMPTZ DEFAULT NOW(),
                updated_at     TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS purchase_orders (
                id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                po_number     TEXT NOT NULL UNIQUE,
                supplier_id   UUID NOT NULL REFERENCES suppliers(id),
                warehouse_id  UUID NOT NULL REFERENCES warehouses(id),
                status        TEXT NOT NULL DEFAULT 'draft',
                total_amount  NUMERIC(14,2) DEFAULT 0,
                initiated_by  TEXT DEFAULT 'agent',
                approved_by   UUID REFERENCES users(id),
                expected_date DATE,
                received_at   TIMESTAMPTZ,
                notes         TEXT,
                ai_reasoning  TEXT,
                created_at    TIMESTAMPTZ DEFAULT NOW(),
                updated_at    TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS stock_transfers (
                id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                transfer_number   TEXT NOT NULL UNIQUE,
                from_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
                to_warehouse_id   UUID NOT NULL REFERENCES warehouses(id),
                product_id        UUID NOT NULL REFERENCES products(id),
                quantity          INTEGER NOT NULL,
                status            TEXT NOT NULL DEFAULT 'pending',
                initiated_by      TEXT DEFAULT 'agent',
                approved_by       UUID REFERENCES users(id),
                ai_reasoning      TEXT,
                dispatched_at     TIMESTAMPTZ,
                received_at       TIMESTAMPTZ,
                created_at        TIMESTAMPTZ DEFAULT NOW(),
                updated_at        TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS deliveries (
                id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                order_id       UUID REFERENCES orders(id),
                po_id          UUID REFERENCES purchase_orders(id),
                vehicle_number TEXT,
                driver_name    TEXT,
                driver_phone   TEXT,
                route          TEXT,
                status         TEXT NOT NULL DEFAULT 'pending',
                dispatched_at  TIMESTAMPTZ,
                estimated_eta  TIMESTAMPTZ,
                delivered_at   TIMESTAMPTZ,
                notes          TEXT,
                created_at     TIMESTAMPTZ DEFAULT NOW(),
                updated_at     TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finance_records (
                id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                warehouse_id   UUID REFERENCES warehouses(id),
                record_type    TEXT NOT NULL,
                reference_id   UUID,
                reference_type TEXT,
                amount         NUMERIC(14,2) NOT NULL,
                currency       TEXT DEFAULT 'INR',
                description    TEXT,
                category       TEXT,
                recorded_date  DATE NOT NULL DEFAULT CURRENT_DATE,
                created_at     TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS agent_logs (
                id             BIGSERIAL PRIMARY KEY,
                agent_name     TEXT NOT NULL,
                action         TEXT NOT NULL,
                input_summary  TEXT,
                output_summary TEXT,
                decision       JSONB,
                confidence     NUMERIC(4,2),
                warehouse_id   UUID REFERENCES warehouses(id),
                reference_id   UUID,
                reference_type TEXT,
                duration_ms    INTEGER,
                status         TEXT DEFAULT 'success',
                error_message  TEXT,
                created_at     TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS executive_decisions (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                decision_type   TEXT NOT NULL,
                title           TEXT NOT NULL,
                summary         TEXT,
                recommendations JSONB,
                kpis_snapshot   JSONB,
                risk_flags      JSONB,
                priority        TEXT DEFAULT 'medium',
                status          TEXT DEFAULT 'pending',
                actioned_by     UUID REFERENCES users(id),
                actioned_at     TIMESTAMPTZ,
                briefing_date   DATE DEFAULT CURRENT_DATE,
                created_at      TIMESTAMPTZ DEFAULT NOW()
            )
        """)

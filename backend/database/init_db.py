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

        # ── Phase 23: Purchase Requisition tables ──────────────────────────────

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS purchase_requisitions (
                id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                pr_number              TEXT NOT NULL UNIQUE,
                workflow_id            TEXT NOT NULL,
                warehouse_id           UUID NOT NULL REFERENCES warehouses(id),
                status                 TEXT NOT NULL DEFAULT 'PENDING',
                total_estimated_value  NUMERIC(14,2) DEFAULT 0,
                required_by            DATE,
                requested_by           TEXT DEFAULT 'branch_manager',
                approved_by            TEXT,
                approved_by_role       TEXT,
                approval_level         TEXT,
                approver_role          TEXT,
                notes                  TEXT,
                rejection_reason       TEXT,
                inventory_analysis     JSONB DEFAULT '{}',
                items                  JSONB DEFAULT '[]',
                escalation_deadline    TIMESTAMPTZ,
                created_at             TIMESTAMPTZ DEFAULT NOW(),
                updated_at             TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS pr_approval_history (
                id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                pr_id         UUID NOT NULL REFERENCES purchase_requisitions(id),
                action        TEXT NOT NULL,
                acted_by      TEXT,
                acted_by_role TEXT,
                notes         TEXT,
                created_at    TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS approval_matrix (
                id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                min_value      NUMERIC(14,2) NOT NULL DEFAULT 0,
                max_value      NUMERIC(14,2),
                approval_level TEXT NOT NULL,
                approver_role  TEXT NOT NULL,
                description    TEXT
            )
        """)

        # Seed approval matrix (idempotent — skip if rows already exist)
        existing = await conn.fetchval("SELECT COUNT(*) FROM approval_matrix")
        if existing == 0:
            await conn.execute("""
                INSERT INTO approval_matrix (min_value, max_value, approval_level, approver_role, description) VALUES
                (0,        500000,    'L1', 'WAREHOUSE_MANAGER',    'Up to ₹5 Lakhs — Warehouse Manager'),
                (500001,   2500000,   'L2', 'OPERATIONS_HEAD',      '₹5L to ₹25L — Operations Head'),
                (2500001,  5000000,   'L3', 'FINANCE_CONTROLLER',   '₹25L to ₹50L — Finance Controller'),
                (5000001,  10000000,  'L4', 'CEO',                  '₹50L to ₹1 Crore — CEO'),
                (10000001, NULL,      'L5', 'CEO_AND_FINANCE',      'Above ₹1 Crore — CEO + Finance Controller')
            """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS agent_events (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                workflow_id TEXT,
                pr_id       UUID REFERENCES purchase_requisitions(id),
                agent_name  TEXT NOT NULL,
                event_type  TEXT NOT NULL,
                payload     JSONB DEFAULT '{}',
                created_at  TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            ALTER TABLE purchase_orders
            ADD COLUMN IF NOT EXISTS pr_id UUID REFERENCES purchase_requisitions(id)
        """)

        await conn.execute("""
            ALTER TABLE purchase_orders
            ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'
        """)

        # ── Phase 26: GRN + Payment tables ────────────────────────────────────

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS goods_receipt_notes (
                id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                grn_number           TEXT NOT NULL UNIQUE,
                po_id                UUID NOT NULL REFERENCES purchase_orders(id),
                warehouse_id         UUID NOT NULL REFERENCES warehouses(id),
                received_by          TEXT DEFAULT 'warehouse_manager',
                status               TEXT NOT NULL DEFAULT 'completed',
                items                JSONB DEFAULT '[]',
                total_received_value NUMERIC(14,2) DEFAULT 0,
                notes                TEXT,
                received_at          TIMESTAMPTZ DEFAULT NOW(),
                created_at           TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                payment_number TEXT NOT NULL UNIQUE,
                po_id          UUID NOT NULL REFERENCES purchase_orders(id),
                grn_id         UUID REFERENCES goods_receipt_notes(id),
                supplier_id    UUID REFERENCES suppliers(id),
                amount         NUMERIC(14,2) NOT NULL,
                payment_mode   TEXT DEFAULT 'bank_transfer',
                payment_date   DATE DEFAULT CURRENT_DATE,
                status         TEXT NOT NULL DEFAULT 'paid',
                invoice_number TEXT,
                notes          TEXT,
                created_at     TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        # ── Phase 25: Supplier seed (idempotent) ──────────────────────────────
        await conn.execute("""
            INSERT INTO suppliers (id, name, contact_person, email, phone, address, city,
                                   categories, reliability_score, risk_score, avg_lead_days,
                                   payment_terms, is_active)
            VALUES
                ('a1b2c3d4-0001-0001-0001-000000000001', 'TechBridge Electronics', 'Rajesh Kumar',
                 'rajesh@techbridge.in', '+91-22-40001001', '101 Tech Park, Andheri East', 'Mumbai',
                 ARRAY['TVs & Displays','Mobiles & Tablets','Gaming Consoles','Networking Equipment','Accessories','Laptops'],
                 9.2, 1.5, 10, 'Net 30', TRUE),
                ('a1b2c3d4-0002-0002-0002-000000000002', 'Horizon Distributors', 'Priya Sharma',
                 'priya@horizondist.in', '+91-11-40002002', '45 Nehru Place, South Delhi', 'Delhi',
                 ARRAY['TVs & Displays','Mobiles & Tablets','Gaming Consoles','Accessories'],
                 8.5, 2.1, 14, 'Net 45', TRUE),
                ('a1b2c3d4-0003-0003-0003-000000000003', 'NetCore Supply Co', 'Anil Reddy',
                 'anil@netcoresupply.in', '+91-80-40003003', '22 Electronic City Phase 1', 'Bangalore',
                 ARRAY['Networking Equipment','Accessories','Laptops'],
                 9.0, 1.8, 7, 'Net 30', TRUE),
                ('a1b2c3d4-0004-0004-0004-000000000004', 'Prime Tech Wholesale', 'Meena Iyer',
                 'meena@primetech.in', '+91-44-40004004', '88 Anna Salai, T Nagar', 'Chennai',
                 ARRAY['Mobiles & Tablets','Laptops','Accessories'],
                 8.0, 2.8, 12, 'Net 30', TRUE),
                ('a1b2c3d4-0005-0005-0005-000000000005', 'Digital Hub India', 'Suresh Rao',
                 'suresh@digitalhub.in', '+91-40-40005005', '15 Cyber Towers, Hitech City', 'Hyderabad',
                 ARRAY['Gaming Consoles','TVs & Displays','Networking Equipment','Accessories'],
                 7.5, 3.2, 21, 'Net 60', TRUE)
            ON CONFLICT (id) DO NOTHING
        """)

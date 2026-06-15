"""
Finance & Profitability tools — async @tool functions with asyncpg pool injected via closure.
Read-only: revenue analysis, cash flow, margin tracking from finance_records + related tables.
"""
import json

import asyncpg
from langchain_core.tools import tool


def create_finance_tools(pool: asyncpg.Pool) -> list:
    """Return the 4 finance tools with pool captured in closure."""

    @tool
    async def get_finance_dashboard(warehouse_id: str | None = None) -> str:
        """Get a top-level finance dashboard — aggregate revenue, costs, net profit, and margin %.

        Provides the full financial picture at a glance: total revenue, total costs,
        net profit, gross margin %, and a per-warehouse breakdown. Call this first to
        identify which branches are profitable and which need attention.

        Args:
            warehouse_id: Optional UUID to filter to a single warehouse. Omit for all branches.

        Returns JSON with overall_summary and per_warehouse breakdown.
        """
        try:
            where = "AND fr.warehouse_id = $1::UUID" if warehouse_id else ""
            params = [warehouse_id] if warehouse_id else []

            overall = await pool.fetchrow(
                f"""
                SELECT
                    ROUND(COALESCE(SUM(fr.amount) FILTER (
                        WHERE fr.record_type = 'revenue'
                    ), 0), 2)::FLOAT                                        AS total_revenue_inr,
                    ROUND(COALESCE(SUM(fr.amount) FILTER (
                        WHERE fr.record_type IN ('cost', 'expense')
                    ), 0), 2)::FLOAT                                        AS total_costs_inr,
                    ROUND(COALESCE(SUM(fr.amount) FILTER (
                        WHERE fr.record_type = 'revenue'
                    ), 0) - COALESCE(SUM(fr.amount) FILTER (
                        WHERE fr.record_type IN ('cost', 'expense')
                    ), 0), 2)::FLOAT                                        AS net_profit_inr,
                    ROUND(
                        CASE
                            WHEN COALESCE(SUM(fr.amount) FILTER (
                                WHERE fr.record_type = 'revenue'
                            ), 0) = 0 THEN 0
                            ELSE 100.0 * (
                                COALESCE(SUM(fr.amount) FILTER (
                                    WHERE fr.record_type = 'revenue'
                                ), 0) - COALESCE(SUM(fr.amount) FILTER (
                                    WHERE fr.record_type IN ('cost', 'expense')
                                ), 0)
                            ) / SUM(fr.amount) FILTER (
                                WHERE fr.record_type = 'revenue'
                            )
                        END
                    , 2)::FLOAT                                             AS gross_margin_pct,
                    COUNT(DISTINCT fr.id) FILTER (
                        WHERE fr.record_type = 'revenue'
                    )                                                       AS revenue_entries,
                    COUNT(DISTINCT fr.id) FILTER (
                        WHERE fr.record_type IN ('cost', 'expense')
                    )                                                       AS cost_entries
                FROM finance_records fr
                WHERE 1=1 {where}
                """,
                *params,
            )

            per_warehouse = await pool.fetch(
                f"""
                SELECT
                    w.city                                                  AS warehouse,
                    w.id::TEXT                                              AS warehouse_id,
                    ROUND(COALESCE(SUM(fr.amount) FILTER (
                        WHERE fr.record_type = 'revenue'
                    ), 0), 2)::FLOAT                                        AS revenue_inr,
                    ROUND(COALESCE(SUM(fr.amount) FILTER (
                        WHERE fr.record_type IN ('cost', 'expense')
                    ), 0), 2)::FLOAT                                        AS costs_inr,
                    ROUND(COALESCE(SUM(fr.amount) FILTER (
                        WHERE fr.record_type = 'revenue'
                    ), 0) - COALESCE(SUM(fr.amount) FILTER (
                        WHERE fr.record_type IN ('cost', 'expense')
                    ), 0), 2)::FLOAT                                        AS net_profit_inr,
                    ROUND(
                        CASE
                            WHEN COALESCE(SUM(fr.amount) FILTER (
                                WHERE fr.record_type = 'revenue'
                            ), 0) = 0 THEN 0
                            ELSE 100.0 * (
                                COALESCE(SUM(fr.amount) FILTER (
                                    WHERE fr.record_type = 'revenue'
                                ), 0) - COALESCE(SUM(fr.amount) FILTER (
                                    WHERE fr.record_type IN ('cost', 'expense')
                                ), 0)
                            ) / NULLIF(SUM(fr.amount) FILTER (
                                WHERE fr.record_type = 'revenue'
                            ), 0)
                        END
                    , 2)::FLOAT                                             AS margin_pct
                FROM warehouses w
                LEFT JOIN finance_records fr ON fr.warehouse_id = w.id
                WHERE w.is_active = TRUE {where.replace("fr.warehouse_id", "w.id")}
                GROUP BY w.id, w.city
                ORDER BY revenue_inr DESC
                """,
                *params,
            )

            return json.dumps({
                "overall_summary": dict(overall) if overall else {},
                "per_warehouse": [dict(r) for r in per_warehouse],
            })
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_revenue_analysis(warehouse_id: str | None = None) -> str:
        """Analyse revenue in detail — by category, by warehouse, and by month (trailing 6 months).

        Surfaces three revenue breakdowns:
        1. By product category (from finance_records.category)
        2. By warehouse branch with month-over-month change
        3. Monthly trend for the trailing 6 months

        Args:
            warehouse_id: Optional UUID to scope to a single branch.

        Returns JSON with by_category, by_warehouse, and monthly_trend sections.
        """
        try:
            where = "AND fr.warehouse_id = $1::UUID" if warehouse_id else ""
            params = [warehouse_id] if warehouse_id else []

            by_category = await pool.fetch(
                f"""
                SELECT
                    COALESCE(fr.category, 'Uncategorised')      AS category,
                    COUNT(fr.id)                                 AS entries,
                    ROUND(SUM(fr.amount), 2)::FLOAT             AS total_inr,
                    ROUND(AVG(fr.amount), 2)::FLOAT             AS avg_per_entry_inr
                FROM finance_records fr
                WHERE fr.record_type = 'revenue' {where}
                GROUP BY fr.category
                ORDER BY total_inr DESC
                """,
                *params,
            )

            by_warehouse = await pool.fetch(
                f"""
                SELECT
                    w.city                                       AS warehouse,
                    ROUND(SUM(fr.amount), 2)::FLOAT             AS revenue_inr,
                    COUNT(fr.id)                                 AS entries,
                    MIN(fr.recorded_date)::TEXT                  AS earliest_record,
                    MAX(fr.recorded_date)::TEXT                  AS latest_record
                FROM finance_records fr
                JOIN warehouses w ON w.id = fr.warehouse_id
                WHERE fr.record_type = 'revenue' {where}
                GROUP BY w.id, w.city
                ORDER BY revenue_inr DESC
                """,
                *params,
            )

            monthly_trend = await pool.fetch(
                f"""
                SELECT
                    TO_CHAR(DATE_TRUNC('month', fr.recorded_date), 'YYYY-MM') AS month,
                    ROUND(SUM(fr.amount), 2)::FLOAT                           AS revenue_inr,
                    COUNT(fr.id)                                               AS entries
                FROM finance_records fr
                WHERE fr.record_type = 'revenue'
                  AND fr.recorded_date >= CURRENT_DATE - INTERVAL '6 months'
                  {where}
                GROUP BY DATE_TRUNC('month', fr.recorded_date)
                ORDER BY month ASC
                """,
                *params,
            )

            return json.dumps({
                "by_category": [dict(r) for r in by_category],
                "by_warehouse": [dict(r) for r in by_warehouse],
                "monthly_trend": [dict(r) for r in monthly_trend],
            })
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_cash_flow_analysis(warehouse_id: str | None = None) -> str:
        """Analyse cash flow — monthly inflows vs outflows over the trailing 12 months.

        Breaks down each month into:
        - Inflows: revenue entries
        - Outflows: cost + expense entries
        - Net cash flow = inflows − outflows
        - Running cumulative cash position

        Also returns a summary of the best and worst months.

        Args:
            warehouse_id: Optional UUID to scope to a single branch.

        Returns JSON with monthly_cash_flow list and summary section.
        """
        try:
            where = "AND fr.warehouse_id = $1::UUID" if warehouse_id else ""
            params = [warehouse_id] if warehouse_id else []

            monthly = await pool.fetch(
                f"""
                SELECT
                    TO_CHAR(DATE_TRUNC('month', fr.recorded_date), 'YYYY-MM') AS month,
                    ROUND(COALESCE(SUM(fr.amount) FILTER (
                        WHERE fr.record_type = 'revenue'
                    ), 0), 2)::FLOAT                                           AS inflow_inr,
                    ROUND(COALESCE(SUM(fr.amount) FILTER (
                        WHERE fr.record_type IN ('cost', 'expense')
                    ), 0), 2)::FLOAT                                           AS outflow_inr,
                    ROUND(
                        COALESCE(SUM(fr.amount) FILTER (
                            WHERE fr.record_type = 'revenue'
                        ), 0) - COALESCE(SUM(fr.amount) FILTER (
                            WHERE fr.record_type IN ('cost', 'expense')
                        ), 0)
                    , 2)::FLOAT                                                AS net_cash_flow_inr
                FROM finance_records fr
                WHERE fr.recorded_date >= CURRENT_DATE - INTERVAL '12 months'
                  {where}
                GROUP BY DATE_TRUNC('month', fr.recorded_date)
                ORDER BY month ASC
                """,
                *params,
            )

            rows = [dict(r) for r in monthly]

            # Build running cumulative
            running = 0.0
            for row in rows:
                running = round(running + row["net_cash_flow_inr"], 2)
                row["cumulative_inr"] = running

            summary_row = await pool.fetchrow(
                f"""
                SELECT
                    ROUND(COALESCE(SUM(fr.amount) FILTER (
                        WHERE fr.record_type = 'revenue'
                    ), 0), 2)::FLOAT                                AS total_inflow_12m_inr,
                    ROUND(COALESCE(SUM(fr.amount) FILTER (
                        WHERE fr.record_type IN ('cost', 'expense')
                    ), 0), 2)::FLOAT                                AS total_outflow_12m_inr,
                    ROUND(
                        COALESCE(SUM(fr.amount) FILTER (
                            WHERE fr.record_type = 'revenue'
                        ), 0) - COALESCE(SUM(fr.amount) FILTER (
                            WHERE fr.record_type IN ('cost', 'expense')
                        ), 0)
                    , 2)::FLOAT                                     AS net_12m_inr,
                    ROUND(AVG(fr.amount) FILTER (
                        WHERE fr.record_type = 'revenue'
                    ), 2)::FLOAT                                    AS avg_monthly_revenue_inr
                FROM finance_records fr
                WHERE fr.recorded_date >= CURRENT_DATE - INTERVAL '12 months'
                  {where}
                """,
                *params,
            )

            return json.dumps({
                "monthly_cash_flow": rows,
                "summary": dict(summary_row) if summary_row else {},
            })
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_margin_tracking(warehouse_id: str | None = None) -> str:
        """Track profit margins at the order level and by product category.

        Joins orders → finance_records (reference_type='order') to compute:
        1. Per-order revenue vs cost vs margin % (top 20 most recent fulfilled orders)
        2. Category-level margin summary across all orders
        3. Low-margin orders (<20%) that need attention

        Args:
            warehouse_id: Optional UUID to scope to a single branch.

        Returns JSON with order_margins, category_margins, and low_margin_orders sections.
        """
        try:
            where_o = "AND o.warehouse_id = $1::UUID" if warehouse_id else ""
            params = [warehouse_id] if warehouse_id else []

            order_margins = await pool.fetch(
                f"""
                SELECT
                    o.order_number,
                    o.customer_name,
                    w.city                                              AS warehouse,
                    o.status,
                    ROUND(o.total_amount, 2)::FLOAT                    AS order_value_inr,
                    ROUND(COALESCE(SUM(fr.amount) FILTER (
                        WHERE fr.record_type = 'revenue'
                    ), 0), 2)::FLOAT                                    AS recorded_revenue_inr,
                    ROUND(COALESCE(SUM(fr.amount) FILTER (
                        WHERE fr.record_type IN ('cost', 'expense')
                    ), 0), 2)::FLOAT                                    AS recorded_cost_inr,
                    ROUND(
                        COALESCE(SUM(fr.amount) FILTER (
                            WHERE fr.record_type = 'revenue'
                        ), 0) - COALESCE(SUM(fr.amount) FILTER (
                            WHERE fr.record_type IN ('cost', 'expense')
                        ), 0)
                    , 2)::FLOAT                                         AS gross_profit_inr,
                    ROUND(
                        CASE
                            WHEN COALESCE(SUM(fr.amount) FILTER (
                                WHERE fr.record_type = 'revenue'
                            ), 0) = 0 THEN 0
                            ELSE 100.0 * (
                                COALESCE(SUM(fr.amount) FILTER (
                                    WHERE fr.record_type = 'revenue'
                                ), 0) - COALESCE(SUM(fr.amount) FILTER (
                                    WHERE fr.record_type IN ('cost', 'expense')
                                ), 0)
                            ) / NULLIF(SUM(fr.amount) FILTER (
                                WHERE fr.record_type = 'revenue'
                            ), 0)
                        END
                    , 2)::FLOAT                                         AS margin_pct
                FROM orders o
                JOIN warehouses w ON w.id = o.warehouse_id
                LEFT JOIN finance_records fr
                    ON fr.reference_id = o.id
                    AND fr.reference_type = 'order'
                WHERE o.status = 'fulfilled' {where_o}
                GROUP BY o.id, o.order_number, o.customer_name, w.city, o.status, o.total_amount
                ORDER BY o.created_at DESC
                LIMIT 20
                """,
                *params,
            )

            category_margins = await pool.fetch(
                f"""
                SELECT
                    COALESCE(fr.category, 'Uncategorised')              AS category,
                    ROUND(COALESCE(SUM(fr.amount) FILTER (
                        WHERE fr.record_type = 'revenue'
                    ), 0), 2)::FLOAT                                    AS revenue_inr,
                    ROUND(COALESCE(SUM(fr.amount) FILTER (
                        WHERE fr.record_type IN ('cost', 'expense')
                    ), 0), 2)::FLOAT                                    AS costs_inr,
                    ROUND(
                        COALESCE(SUM(fr.amount) FILTER (
                            WHERE fr.record_type = 'revenue'
                        ), 0) - COALESCE(SUM(fr.amount) FILTER (
                            WHERE fr.record_type IN ('cost', 'expense')
                        ), 0)
                    , 2)::FLOAT                                         AS gross_profit_inr,
                    ROUND(
                        CASE
                            WHEN COALESCE(SUM(fr.amount) FILTER (
                                WHERE fr.record_type = 'revenue'
                            ), 0) = 0 THEN 0
                            ELSE 100.0 * (
                                COALESCE(SUM(fr.amount) FILTER (
                                    WHERE fr.record_type = 'revenue'
                                ), 0) - COALESCE(SUM(fr.amount) FILTER (
                                    WHERE fr.record_type IN ('cost', 'expense')
                                ), 0)
                            ) / NULLIF(SUM(fr.amount) FILTER (
                                WHERE fr.record_type = 'revenue'
                            ), 0)
                        END
                    , 2)::FLOAT                                         AS margin_pct
                FROM finance_records fr
                WHERE fr.warehouse_id IN (
                    SELECT id FROM warehouses WHERE is_active = TRUE
                )
                {"AND fr.warehouse_id = $1::UUID" if warehouse_id else ""}
                GROUP BY fr.category
                ORDER BY margin_pct ASC
                """,
                *params,
            )

            low_margin = [r for r in [dict(x) for x in order_margins] if (r.get("margin_pct") or 0) < 20]

            return json.dumps({
                "order_margins": [dict(r) for r in order_margins],
                "category_margins": [dict(r) for r in category_margins],
                "low_margin_orders": low_margin,
            })
        except Exception as e:
            return json.dumps({"error": str(e)})

    return [
        get_finance_dashboard,
        get_revenue_analysis,
        get_cash_flow_analysis,
        get_margin_tracking,
    ]

"""
Order Fulfillment tools — async @tool functions with asyncpg pool injected via closure.
One write tool: escalate_order sets priority='urgent' and appends an escalation note.
"""
import json
from datetime import datetime, timezone

import asyncpg
from langchain_core.tools import tool


def create_order_fulfillment_tools(pool: asyncpg.Pool) -> list:
    """Return the 4 order fulfillment tools with pool captured in closure."""

    @tool
    async def get_order_pipeline(warehouse_id: str = "") -> str:
        """Get the full order pipeline — count by status per warehouse.

        Shows how many orders are at each stage: pending, confirmed, processing,
        dispatched, fulfilled, cancelled. Includes total order value and overdue count.

        Args:
            warehouse_id: Optional UUID to filter by warehouse. Leave empty for all branches.

        Returns JSON list with warehouse, status counts, total_value, and overdue count.
        """
        try:
            if warehouse_id:
                rows = await pool.fetch(
                    """
                    SELECT
                        w.city                                              AS warehouse,
                        COUNT(*) FILTER (WHERE o.status = 'pending')       AS pending,
                        COUNT(*) FILTER (WHERE o.status = 'confirmed')      AS confirmed,
                        COUNT(*) FILTER (WHERE o.status = 'processing')     AS processing,
                        COUNT(*) FILTER (WHERE o.status = 'dispatched')     AS dispatched,
                        COUNT(*) FILTER (WHERE o.status = 'fulfilled')      AS fulfilled,
                        COUNT(*) FILTER (WHERE o.status = 'cancelled')      AS cancelled,
                        COUNT(*) FILTER (
                            WHERE o.status NOT IN ('fulfilled', 'cancelled')
                              AND o.due_date < CURRENT_DATE
                        )                                                   AS overdue,
                        ROUND(SUM(o.total_amount) FILTER (
                            WHERE o.status NOT IN ('fulfilled', 'cancelled')
                        ), 2)::FLOAT                                        AS open_value_inr
                    FROM orders o
                    JOIN warehouses w ON w.id = o.warehouse_id
                    WHERE o.warehouse_id = $1::uuid
                    GROUP BY w.id, w.city
                    """,
                    warehouse_id,
                )
            else:
                rows = await pool.fetch(
                    """
                    SELECT
                        w.city                                              AS warehouse,
                        w.id::TEXT                                          AS warehouse_id,
                        COUNT(*) FILTER (WHERE o.status = 'pending')       AS pending,
                        COUNT(*) FILTER (WHERE o.status = 'confirmed')      AS confirmed,
                        COUNT(*) FILTER (WHERE o.status = 'processing')     AS processing,
                        COUNT(*) FILTER (WHERE o.status = 'dispatched')     AS dispatched,
                        COUNT(*) FILTER (WHERE o.status = 'fulfilled')      AS fulfilled,
                        COUNT(*) FILTER (WHERE o.status = 'cancelled')      AS cancelled,
                        COUNT(*) FILTER (
                            WHERE o.status NOT IN ('fulfilled', 'cancelled')
                              AND o.due_date < CURRENT_DATE
                        )                                                   AS overdue,
                        ROUND(SUM(o.total_amount) FILTER (
                            WHERE o.status NOT IN ('fulfilled', 'cancelled')
                        ), 2)::FLOAT                                        AS open_value_inr
                    FROM orders o
                    JOIN warehouses w ON w.id = o.warehouse_id
                    GROUP BY w.id, w.city
                    ORDER BY overdue DESC, open_value_inr DESC
                    """
                )
            if not rows:
                return json.dumps({"status": "no_data", "message": "No order data found."})
            return json.dumps([dict(r) for r in rows])
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_delayed_orders(warehouse_id: str = "") -> str:
        """Find orders past their due date that are not yet fulfilled or cancelled.

        Includes delivery tracking info for dispatched orders — shows if in transit
        or stuck at an earlier stage. Sorted by days_overdue descending (worst first).

        Args:
            warehouse_id: Optional UUID to filter by warehouse. Leave empty for all branches.

        Returns JSON list with order details, days_overdue, delivery status, and customer contact.
        """
        try:
            if warehouse_id:
                rows = await pool.fetch(
                    """
                    SELECT
                        o.id::TEXT          AS order_id,
                        o.order_number,
                        o.customer_name,
                        o.customer_phone,
                        o.customer_email,
                        w.city              AS warehouse,
                        o.status            AS order_status,
                        o.priority,
                        ROUND(o.total_amount, 2)::FLOAT AS total_amount,
                        o.due_date::TEXT    AS due_date,
                        (CURRENT_DATE - o.due_date) AS days_overdue,
                        d.status            AS delivery_status,
                        d.vehicle_number,
                        d.driver_name,
                        d.driver_phone,
                        d.estimated_eta::TEXT AS estimated_eta,
                        d.route
                    FROM orders o
                    JOIN warehouses w ON w.id = o.warehouse_id
                    LEFT JOIN deliveries d ON d.order_id = o.id
                    WHERE o.warehouse_id = $1::uuid
                      AND o.status NOT IN ('fulfilled', 'cancelled')
                      AND o.due_date < CURRENT_DATE
                    ORDER BY days_overdue DESC, o.total_amount DESC
                    """,
                    warehouse_id,
                )
            else:
                rows = await pool.fetch(
                    """
                    SELECT
                        o.id::TEXT          AS order_id,
                        o.order_number,
                        o.customer_name,
                        o.customer_phone,
                        o.customer_email,
                        w.city              AS warehouse,
                        o.status            AS order_status,
                        o.priority,
                        ROUND(o.total_amount, 2)::FLOAT AS total_amount,
                        o.due_date::TEXT    AS due_date,
                        (CURRENT_DATE - o.due_date) AS days_overdue,
                        d.status            AS delivery_status,
                        d.vehicle_number,
                        d.driver_name,
                        d.driver_phone,
                        d.estimated_eta::TEXT AS estimated_eta,
                        d.route
                    FROM orders o
                    JOIN warehouses w ON w.id = o.warehouse_id
                    LEFT JOIN deliveries d ON d.order_id = o.id
                    WHERE o.status NOT IN ('fulfilled', 'cancelled')
                      AND o.due_date < CURRENT_DATE
                    ORDER BY days_overdue DESC, o.total_amount DESC
                    """
                )
            if not rows:
                return json.dumps({"status": "ok", "message": "No delayed orders — all orders on track."})
            return json.dumps([dict(r) for r in rows])
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_order_details(order_number: str) -> str:
        """Look up full details for a specific order including delivery tracking.

        Args:
            order_number: The order number string (e.g. 'ORD-20250614-A1B2C3').

        Returns JSON with complete order info, customer details, and delivery tracking.
        """
        try:
            row = await pool.fetchrow(
                """
                SELECT
                    o.id::TEXT          AS order_id,
                    o.order_number,
                    o.customer_name,
                    o.customer_email,
                    o.customer_phone,
                    w.name              AS warehouse,
                    w.city,
                    o.status,
                    o.priority,
                    ROUND(o.total_amount, 2)::FLOAT AS total_amount,
                    o.due_date::TEXT    AS due_date,
                    o.notes,
                    o.created_at::TEXT  AS created_at,
                    o.fulfilled_at::TEXT AS fulfilled_at,
                    d.status            AS delivery_status,
                    d.vehicle_number,
                    d.driver_name,
                    d.driver_phone,
                    d.route,
                    d.dispatched_at::TEXT  AS dispatched_at,
                    d.estimated_eta::TEXT  AS estimated_eta,
                    d.delivered_at::TEXT   AS delivered_at,
                    (o.due_date IS NOT NULL AND o.due_date < CURRENT_DATE
                     AND o.status NOT IN ('fulfilled', 'cancelled')) AS is_overdue,
                    CASE
                        WHEN o.due_date IS NOT NULL AND o.status NOT IN ('fulfilled', 'cancelled')
                        THEN (CURRENT_DATE - o.due_date)
                    END                 AS days_overdue
                FROM orders o
                JOIN warehouses  w ON w.id = o.warehouse_id
                LEFT JOIN deliveries d ON d.order_id = o.id
                WHERE o.order_number = $1
                """,
                order_number,
            )
            if not row:
                return json.dumps({"error": f"Order '{order_number}' not found."})
            return json.dumps(dict(row))
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def escalate_order(order_id: str, reason: str) -> str:
        """Escalate a delayed or at-risk order — sets priority to 'urgent' and records escalation reason.

        Use when an order is significantly overdue, high-value, or the customer is at risk.
        Appends the escalation reason to the order notes with a timestamp for audit trail.
        The Communication Agent (Phase 14) will send notifications to the customer and manager.

        Args:
            order_id: UUID of the order to escalate (from get_delayed_orders).
            reason: Clear explanation of why this order is being escalated.

        Returns JSON with order_number, previous priority, new priority, and escalation note.
        """
        try:
            order = await pool.fetchrow(
                "SELECT id, order_number, priority, status, notes FROM orders WHERE id = $1::uuid",
                order_id,
            )
            if not order:
                return json.dumps({"error": f"Order '{order_id}' not found."})
            if order["status"] in ("fulfilled", "cancelled"):
                return json.dumps({
                    "error": f"Order '{order['order_number']}' is already {order['status']} — cannot escalate."
                })

            timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            escalation_note = f"[ESCALATED {timestamp}] {reason}"
            existing_notes = order["notes"] or ""
            new_notes = f"{existing_notes}\n{escalation_note}".strip()

            await pool.execute(
                """
                UPDATE orders
                SET priority   = 'urgent',
                    notes      = $1,
                    updated_at = NOW()
                WHERE id = $2::uuid
                """,
                new_notes,
                order_id,
            )
            return json.dumps({
                "escalated": True,
                "order_number": order["order_number"],
                "previous_priority": order["priority"],
                "new_priority": "urgent",
                "escalation_note": escalation_note,
                "note": "Order escalated to urgent. Communication Agent should notify customer and manager.",
            })
        except Exception as e:
            return json.dumps({"error": str(e)})

    return [
        get_order_pipeline,
        get_delayed_orders,
        get_order_details,
        escalate_order,
    ]

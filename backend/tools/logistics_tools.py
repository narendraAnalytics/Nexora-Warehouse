"""
Logistics & Dispatch tools — async @tool functions with asyncpg pool injected via closure.
One write tool: create_dispatch creates a delivery record and marks order as dispatched.
"""
import json
from datetime import datetime, timedelta, timezone

import asyncpg
from langchain_core.tools import tool


def create_logistics_tools(pool: asyncpg.Pool) -> list:
    """Return the 4 logistics tools with pool captured in closure."""

    @tool
    async def get_dispatch_queue(warehouse_id: str = "") -> str:
        """Get orders ready to dispatch — confirmed/processing orders with no delivery record yet.

        Sorted by priority (urgent → high → normal → low) then due_date ASC so the most
        time-sensitive orders surface first.

        Args:
            warehouse_id: Optional UUID to filter by warehouse. Leave empty for all branches.

        Returns JSON list with order_number, customer, warehouse city, priority, status,
        total_amount, due_date, age_days.
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
                        w.city              AS warehouse,
                        w.id::TEXT          AS warehouse_id,
                        o.status,
                        o.priority,
                        ROUND(o.total_amount, 2)::FLOAT AS total_amount,
                        o.due_date::TEXT    AS due_date,
                        (CURRENT_DATE - o.created_at::DATE) AS age_days,
                        o.notes
                    FROM orders o
                    JOIN warehouses w ON w.id = o.warehouse_id
                    WHERE o.warehouse_id = $1::uuid
                      AND o.status IN ('confirmed', 'processing', 'approved')
                      AND NOT EXISTS (
                          SELECT 1 FROM deliveries d WHERE d.order_id = o.id
                      )
                    ORDER BY
                        CASE o.priority
                            WHEN 'urgent'  THEN 1
                            WHEN 'high'    THEN 2
                            WHEN 'normal'  THEN 3
                            WHEN 'low'     THEN 4
                            ELSE 5
                        END,
                        o.due_date ASC NULLS LAST,
                        o.created_at ASC
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
                        w.city              AS warehouse,
                        w.id::TEXT          AS warehouse_id,
                        o.status,
                        o.priority,
                        ROUND(o.total_amount, 2)::FLOAT AS total_amount,
                        o.due_date::TEXT    AS due_date,
                        (CURRENT_DATE - o.created_at::DATE) AS age_days,
                        o.notes
                    FROM orders o
                    JOIN warehouses w ON w.id = o.warehouse_id
                    WHERE o.status IN ('confirmed', 'processing', 'approved')
                      AND NOT EXISTS (
                          SELECT 1 FROM deliveries d WHERE d.order_id = o.id
                      )
                    ORDER BY
                        CASE o.priority
                            WHEN 'urgent'  THEN 1
                            WHEN 'high'    THEN 2
                            WHEN 'normal'  THEN 3
                            WHEN 'low'     THEN 4
                            ELSE 5
                        END,
                        o.due_date ASC NULLS LAST,
                        o.created_at ASC
                    """
                )
            if not rows:
                return json.dumps({"status": "clear", "message": "No orders pending dispatch."})
            return json.dumps([dict(r) for r in rows])
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_active_deliveries(warehouse_id: str = "") -> str:
        """Get all deliveries currently in transit, with ETA status and overdue flag.

        Args:
            warehouse_id: Optional UUID to filter by source warehouse. Leave empty for all branches.

        Returns JSON list with delivery details, vehicle/driver info, estimated_eta,
        is_overdue flag, and hours_overdue (negative means still on time).
        """
        try:
            if warehouse_id:
                rows = await pool.fetch(
                    """
                    SELECT
                        d.id::TEXT                                   AS delivery_id,
                        o.order_number,
                        o.customer_name,
                        o.priority,
                        w.city                                       AS from_warehouse,
                        d.vehicle_number,
                        d.driver_name,
                        d.driver_phone,
                        d.route,
                        d.status,
                        d.dispatched_at::TEXT                        AS dispatched_at,
                        d.estimated_eta::TEXT                        AS estimated_eta,
                        d.estimated_eta < NOW()                      AS is_overdue,
                        ROUND(
                            EXTRACT(EPOCH FROM (NOW() - d.estimated_eta)) / 3600,
                            1
                        )::FLOAT                                     AS hours_overdue
                    FROM deliveries d
                    JOIN orders     o ON o.id = d.order_id
                    JOIN warehouses w ON w.id = o.warehouse_id
                    WHERE d.status IN ('dispatched', 'in_transit')
                      AND o.warehouse_id = $1::uuid
                    ORDER BY d.estimated_eta ASC
                    """,
                    warehouse_id,
                )
            else:
                rows = await pool.fetch(
                    """
                    SELECT
                        d.id::TEXT                                   AS delivery_id,
                        o.order_number,
                        o.customer_name,
                        o.priority,
                        w.city                                       AS from_warehouse,
                        d.vehicle_number,
                        d.driver_name,
                        d.driver_phone,
                        d.route,
                        d.status,
                        d.dispatched_at::TEXT                        AS dispatched_at,
                        d.estimated_eta::TEXT                        AS estimated_eta,
                        d.estimated_eta < NOW()                      AS is_overdue,
                        ROUND(
                            EXTRACT(EPOCH FROM (NOW() - d.estimated_eta)) / 3600,
                            1
                        )::FLOAT                                     AS hours_overdue
                    FROM deliveries d
                    JOIN orders     o ON o.id = d.order_id
                    JOIN warehouses w ON w.id = o.warehouse_id
                    WHERE d.status IN ('dispatched', 'in_transit')
                    ORDER BY d.estimated_eta ASC
                    """
                )
            if not rows:
                return json.dumps({"status": "clear", "message": "No active deliveries in transit."})
            return json.dumps([dict(r) for r in rows])
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_delivery_performance() -> str:
        """Get delivery performance statistics across all Nexora branches.

        Returns per-warehouse stats: total deliveries, on-time rate, avg delivery hours,
        currently in-transit count, and overdue count. Use for logistics health assessment.
        """
        try:
            rows = await pool.fetch(
                """
                SELECT
                    w.city                                           AS warehouse,
                    COUNT(d.id)                                      AS total_deliveries,
                    COUNT(d.id) FILTER (
                        WHERE d.status = 'delivered'
                    )                                                AS delivered,
                    COUNT(d.id) FILTER (
                        WHERE d.status = 'delivered'
                          AND d.delivered_at <= d.estimated_eta
                    )                                                AS on_time,
                    ROUND(
                        100.0 * COUNT(d.id) FILTER (
                            WHERE d.status = 'delivered'
                              AND d.delivered_at <= d.estimated_eta
                        ) / NULLIF(COUNT(d.id) FILTER (WHERE d.status = 'delivered'), 0),
                        1
                    )::FLOAT                                         AS on_time_rate_pct,
                    ROUND(
                        AVG(
                            EXTRACT(EPOCH FROM (d.delivered_at - d.dispatched_at)) / 3600
                        ) FILTER (WHERE d.status = 'delivered' AND d.dispatched_at IS NOT NULL),
                        1
                    )::FLOAT                                         AS avg_delivery_hours,
                    COUNT(d.id) FILTER (
                        WHERE d.status IN ('dispatched', 'in_transit')
                    )                                                AS in_transit,
                    COUNT(d.id) FILTER (
                        WHERE d.status IN ('dispatched', 'in_transit')
                          AND d.estimated_eta < NOW()
                    )                                                AS overdue
                FROM warehouses w
                LEFT JOIN orders     o ON o.warehouse_id = w.id
                LEFT JOIN deliveries d ON d.order_id     = o.id
                WHERE w.is_active = TRUE
                GROUP BY w.id, w.city
                ORDER BY on_time_rate_pct ASC NULLS LAST
                """
            )
            if not rows:
                return json.dumps({"status": "no_data", "message": "No delivery data found."})
            return json.dumps([dict(r) for r in rows])
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def create_dispatch(
        order_id: str,
        vehicle_number: str,
        driver_name: str,
        driver_phone: str,
        route: str,
        estimated_hours: float,
    ) -> str:
        """Dispatch an order — creates a delivery record and updates order status to 'dispatched'.

        Args:
            order_id: UUID of the order to dispatch (from get_dispatch_queue).
            vehicle_number: Vehicle registration number (e.g. 'TS09AB1234').
            driver_name: Driver's full name.
            driver_phone: Driver's contact number.
            route: Route description (e.g. 'Hyderabad → Chennai via NH44').
            estimated_hours: Estimated delivery time in hours from now.

        Returns JSON with delivery_id, order_number, vehicle, route, estimated_eta, status.
        """
        try:
            order = await pool.fetchrow(
                "SELECT id, order_number, status FROM orders WHERE id = $1::uuid",
                order_id,
            )
            if not order:
                return json.dumps({"error": f"Order '{order_id}' not found."})
            if order["status"] not in ("confirmed", "processing", "approved"):
                return json.dumps({
                    "error": f"Order '{order['order_number']}' has status '{order['status']}' — cannot dispatch."
                })

            now = datetime.now(timezone.utc)
            estimated_eta = now + timedelta(hours=estimated_hours)

            async with pool.acquire() as conn:
                async with conn.transaction():
                    delivery = await conn.fetchrow(
                        """
                        INSERT INTO deliveries
                            (order_id, vehicle_number, driver_name, driver_phone,
                             route, status, dispatched_at, estimated_eta)
                        VALUES ($1::uuid, $2, $3, $4, $5, 'dispatched', $6, $7)
                        RETURNING id::TEXT AS delivery_id, status,
                                  dispatched_at::TEXT, estimated_eta::TEXT
                        """,
                        order_id,
                        vehicle_number,
                        driver_name,
                        driver_phone,
                        route,
                        now,
                        estimated_eta,
                    )
                    await conn.execute(
                        "UPDATE orders SET status = 'dispatched', updated_at = NOW() WHERE id = $1::uuid",
                        order_id,
                    )

            return json.dumps({
                "dispatched": True,
                "delivery_id": delivery["delivery_id"],
                "order_number": order["order_number"],
                "vehicle": vehicle_number,
                "driver": driver_name,
                "route": route,
                "dispatched_at": delivery["dispatched_at"],
                "estimated_eta": delivery["estimated_eta"],
                "status": delivery["status"],
            })
        except Exception as e:
            return json.dumps({"error": str(e)})

    return [
        get_dispatch_queue,
        get_active_deliveries,
        get_delivery_performance,
        create_dispatch,
    ]

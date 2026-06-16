import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const rows = await sql`
      SELECT
        w.name,
        w.city,
        COALESCE(SUM(i.quantity::numeric * p.unit_price), 0) AS inventory_value,
        CASE WHEN COALESCE(SUM(i.max_stock), 0) > 0
          THEN ROUND(100.0 * COALESCE(SUM(i.quantity), 0) / SUM(i.max_stock))::int
          ELSE 0 END AS utilization_pct,
        COALESCE((
          SELECT ROUND(
            100.0 * COUNT(*) FILTER (
              WHERE d.delivered_at IS NOT NULL AND d.delivered_at <= d.estimated_eta
            ) / NULLIF(COUNT(*), 0), 1
          )::numeric
          FROM deliveries d
          JOIN orders o2 ON o2.id = d.order_id
          WHERE o2.warehouse_id = w.id
        ), 0) AS otd_pct
      FROM warehouses w
      LEFT JOIN inventory i ON i.warehouse_id = w.id
      LEFT JOIN products p ON p.id = i.product_id
      GROUP BY w.id, w.name, w.city
      ORDER BY inventory_value DESC
    `
    return NextResponse.json(
      rows.map((r) => ({
        name: r.name,
        city: r.city,
        inventoryValue: Number(r.inventory_value),
        utilizationPct: Number(r.utilization_pct),
        otdPct: Number(r.otd_pct),
      }))
    )
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

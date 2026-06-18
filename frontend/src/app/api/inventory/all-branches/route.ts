import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  const rows = await sql`
    SELECT
      w.id          AS warehouse_id,
      w.name        AS warehouse_name,
      w.city        AS warehouse_city,
      COUNT(i.id)::int                                                                                   AS total,
      SUM(CASE WHEN i.quantity <= i.reorder_point                                             THEN 1 ELSE 0 END)::int AS critical,
      SUM(CASE WHEN i.quantity >  i.reorder_point AND i.quantity <= (i.reorder_point * 1.5)  THEN 1 ELSE 0 END)::int AS low,
      SUM(CASE WHEN i.max_stock > 0 AND i.quantity >= i.max_stock                            THEN 1 ELSE 0 END)::int AS overstock,
      SUM(CASE WHEN i.quantity >  (i.reorder_point * 1.5)
               AND (i.max_stock = 0 OR i.quantity < i.max_stock)                             THEN 1 ELSE 0 END)::int AS ok
    FROM warehouses w
    LEFT JOIN inventory i ON i.warehouse_id = w.id
    LEFT JOIN products  p ON p.id = i.product_id AND p.is_active = TRUE
    WHERE w.is_active = TRUE
    GROUP BY w.id, w.name, w.city
    ORDER BY w.name
  `

  const branches = rows.map(r => ({
    warehouse_id:   r.warehouse_id,
    name:           r.warehouse_name,
    city:           r.warehouse_city,
    total:          r.total    ?? 0,
    critical:       r.critical ?? 0,
    low:            r.low      ?? 0,
    ok:             r.ok       ?? 0,
    overstock:      r.overstock ?? 0,
  }))

  const aggregated = {
    total:    branches.reduce((s, b) => s + b.total,    0),
    critical: branches.reduce((s, b) => s + b.critical, 0),
    low:      branches.reduce((s, b) => s + b.low,      0),
    ok:       branches.reduce((s, b) => s + b.ok,       0),
    overstock:branches.reduce((s, b) => s + b.overstock,0),
  }

  return NextResponse.json({ aggregated, branches })
}

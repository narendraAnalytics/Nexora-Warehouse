import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const [wh] = await sql`SELECT id FROM warehouses WHERE city = 'Chennai' LIMIT 1`
    if (!wh) return NextResponse.json([])
    const whId = wh.id

    const rows = await sql`
      SELECT
        p.category,
        COALESCE(SUM(i.quantity::numeric * p.unit_price), 0) AS value
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE i.warehouse_id = ${whId}
      GROUP BY p.category
      ORDER BY value DESC
    `
    return NextResponse.json(
      rows.map((r) => ({
        category: r.category as string,
        value:    Number(r.value),
      }))
    )
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Get Bangalore warehouse id
    const [wh] = await sql`SELECT id FROM warehouses WHERE city = 'Bangalore' LIMIT 1`
    if (!wh) return NextResponse.json({ error: "Bangalore warehouse not found" }, { status: 404 })
    const whId = wh.id

    const [invRow] = await sql`
      SELECT COALESCE(SUM(i.quantity::numeric * p.unit_price), 0) AS inventory_value
      FROM inventory i JOIN products p ON i.product_id = p.id
      WHERE i.warehouse_id = ${whId}
    `
    const [ordRow] = await sql`
      SELECT COUNT(*)::int AS count FROM orders
      WHERE warehouse_id = ${whId} AND created_at >= NOW() - INTERVAL '7 days'
    `
    const [shipRow] = await sql`
      SELECT COUNT(*)::int AS count FROM deliveries d
      JOIN orders o ON d.order_id = o.id
      WHERE o.warehouse_id = ${whId} AND d.created_at >= NOW() - INTERVAL '7 days'
    `
    const [otdRow] = await sql`
      SELECT COALESCE(ROUND(
        100.0 * COUNT(*) FILTER (WHERE d.delivered_at IS NOT NULL AND d.delivered_at <= d.estimated_eta)
        / NULLIF(COUNT(*), 0), 1
      ), 0) AS pct
      FROM deliveries d
      JOIN orders o ON d.order_id = o.id
      WHERE o.warehouse_id = ${whId}
    `
    const [skuRow] = await sql`
      SELECT COUNT(DISTINCT i.product_id)::int AS count
      FROM inventory i JOIN products p ON i.product_id = p.id
      WHERE i.warehouse_id = ${whId} AND p.is_active = true
    `
    return NextResponse.json({
      inventoryValue: Number(invRow.inventory_value),
      totalOrders:    Number(ordRow.count),
      totalShipments: Number(shipRow.count),
      onTimeDelivery: Number(otdRow.pct),
      activeSKUs:     Number(skuRow.count),
      pendingPOs:     null,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const [invRow] = await sql`
      SELECT COALESCE(SUM(i.quantity::numeric * p.unit_price), 0) AS inventory_value
      FROM inventory i JOIN products p ON i.product_id = p.id
    `
    const [ordRow] = await sql`
      SELECT COUNT(*)::int AS count FROM orders
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `
    const [shipRow] = await sql`
      SELECT COUNT(*)::int AS count FROM deliveries
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `
    const [otdRow] = await sql`
      SELECT COALESCE(ROUND(
        100.0 * COUNT(*) FILTER (WHERE delivered_at IS NOT NULL AND delivered_at <= estimated_eta)
        / NULLIF(COUNT(*), 0), 1
      ), 0) AS pct
      FROM deliveries
    `
    const [prodRow] = await sql`
      SELECT COUNT(*)::int AS count FROM products WHERE is_active = true
    `
    return NextResponse.json({
      inventoryValue: Number(invRow.inventory_value),
      totalOrders: Number(ordRow.count),
      totalShipments: Number(shipRow.count),
      onTimeDelivery: Number(otdRow.pct),
      activeProducts: Number(prodRow.count),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

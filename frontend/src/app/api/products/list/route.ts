import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, sku, name, category, brand,
             unit_price, unit_of_measure, is_active, created_at
      FROM products
      ORDER BY created_at DESC
    `
    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

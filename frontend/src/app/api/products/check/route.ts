import { sql } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sku       = searchParams.get("sku")
    const name      = searchParams.get("name")
    const excludeId = searchParams.get("excludeId")

    if (sku) {
      const rows = excludeId
        ? await sql`SELECT 1 FROM products WHERE sku = ${sku} AND id != ${excludeId}::uuid LIMIT 1`
        : await sql`SELECT 1 FROM products WHERE sku = ${sku} LIMIT 1`
      return NextResponse.json({ exists: rows.length > 0 })
    }
    if (name) {
      const rows = excludeId
        ? await sql`SELECT 1 FROM products WHERE LOWER(name) = LOWER(${name}) AND id != ${excludeId}::uuid LIMIT 1`
        : await sql`SELECT 1 FROM products WHERE LOWER(name) = LOWER(${name}) LIMIT 1`
      return NextResponse.json({ exists: rows.length > 0 })
    }
    return NextResponse.json({ exists: false })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

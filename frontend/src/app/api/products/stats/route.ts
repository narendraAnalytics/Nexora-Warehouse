import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const [row] = await sql`
      SELECT
        COUNT(*)::int                                    AS total,
        COUNT(*) FILTER (WHERE is_active = true)::int   AS active,
        COUNT(*) FILTER (WHERE is_active = false)::int  AS draft
      FROM products
    `
    return NextResponse.json({
      total:  Number(row.total),
      active: Number(row.active),
      draft:  Number(row.draft),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

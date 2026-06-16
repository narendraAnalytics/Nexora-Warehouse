import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const rows = await sql`
      WITH dates AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '7 days',
          CURRENT_DATE,
          '1 day'::interval
        )::date AS day
      )
      SELECT d.day::text AS day, COALESCE(COUNT(o.id), 0)::int AS count
      FROM dates d
      LEFT JOIN orders o ON o.created_at::date = d.day
      GROUP BY d.day
      ORDER BY d.day
    `
    return NextResponse.json(
      rows.map((r) => ({ day: r.day as string, count: Number(r.count) }))
    )
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

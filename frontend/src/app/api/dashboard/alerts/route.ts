import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const [countRow] = await sql`
      SELECT COUNT(*)::int AS count FROM agent_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `
    const rows = await sql`
      SELECT agent_name, action, input_summary, output_summary, status, created_at
      FROM agent_logs
      ORDER BY created_at DESC
      LIMIT 6
    `
    return NextResponse.json({
      count: countRow.count as number,
      alerts: rows.map((r) => ({
        agentName: r.agent_name as string,
        action:    r.action as string,
        summary:   (r.output_summary || r.input_summary || r.action) as string,
        status:    r.status as string,
        createdAt: r.created_at as string,
      })),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const rows = await sql`
      SELECT agent_name, action, input_summary, output_summary, status, created_at
      FROM agent_logs
      ORDER BY created_at DESC
      LIMIT 4
    `
    return NextResponse.json(
      rows.map((r) => ({
        agentName: r.agent_name as string,
        action: r.action as string,
        summary: (r.output_summary || r.input_summary || r.action) as string,
        status: r.status as string,
        createdAt: r.created_at as string,
      }))
    )
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

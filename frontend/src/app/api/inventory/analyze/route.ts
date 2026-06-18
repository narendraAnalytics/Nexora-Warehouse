import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

const BACKEND_URL = process.env.BACKEND_URL ?? "https://nexora-warehouse.onrender.com"

const SLUG_MAP: Record<string, string> = {
  bangalore: "531e5c42-e4a1-4db0-a35c-a434f3b94344",
}

async function resolveWarehouseId(branch: string): Promise<string> {
  const slug = branch.toLowerCase()
  if (SLUG_MAP[slug]) return SLUG_MAP[slug]
  const rows = await sql`
    SELECT id FROM warehouses WHERE LOWER(city) = LOWER(${branch}) AND is_active = TRUE LIMIT 1
  `
  return rows[0]?.id ?? SLUG_MAP.bangalore
}

export async function POST(req: Request) {
  const body   = await req.json().catch(() => ({}))
  const { searchParams } = new URL(req.url)
  const branch = searchParams.get("branch") ?? body.branch ?? "bangalore"

  const warehouseId = await resolveWarehouseId(branch)
  const payload = { ...body, warehouse_id: warehouseId }
  delete payload.branch

  const res = await fetch(`${BACKEND_URL}/inventory/analyze`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

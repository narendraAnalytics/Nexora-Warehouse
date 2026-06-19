import { NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL ?? "https://nexora-warehouse.onrender.com"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const res = await fetch(`${BACKEND_URL}/procurement/pr/generate`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const warehouseId = searchParams.get("warehouse_id") ?? ""
  const status      = searchParams.get("status") ?? ""

  const params = new URLSearchParams()
  if (warehouseId) params.set("warehouse_id", warehouseId)
  if (status)      params.set("status", status)

  const res = await fetch(`${BACKEND_URL}/procurement/pr?${params}`)
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

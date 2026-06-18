import { NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL ?? "https://nexora-warehouse.onrender.com"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))

  const res = await fetch(`${BACKEND_URL}/inventory/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

import { NextRequest, NextResponse } from "next/server"

const BACKEND = process.env.BACKEND_URL ?? "https://nexora-warehouse.onrender.com"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const qs = searchParams.toString()
  const res = await fetch(`${BACKEND}/procurement/po${qs ? `?${qs}` : ""}`)
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

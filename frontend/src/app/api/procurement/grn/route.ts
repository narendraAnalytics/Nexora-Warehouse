import { NextRequest, NextResponse } from "next/server"

const BACKEND = process.env.BACKEND_URL ?? "https://nexora-warehouse.onrender.com"

export async function GET(req: NextRequest) {
  const po_id = req.nextUrl.searchParams.get("po_id")
  const url = `${BACKEND}/procurement/grn${po_id ? `?po_id=${po_id}` : ""}`
  const res = await fetch(url)
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

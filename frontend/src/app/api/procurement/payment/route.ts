import { NextRequest, NextResponse } from "next/server"

const BACKEND = process.env.BACKEND_URL ?? "https://nexora-warehouse.onrender.com"

export async function GET(req: NextRequest) {
  const grn_id = req.nextUrl.searchParams.get("grn_id")
  const po_id  = req.nextUrl.searchParams.get("po_id")
  const params = new URLSearchParams()
  if (grn_id) params.set("grn_id", grn_id)
  if (po_id)  params.set("po_id", po_id)
  const url = `${BACKEND}/procurement/payment${params.toString() ? `?${params}` : ""}`
  const res = await fetch(url)
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

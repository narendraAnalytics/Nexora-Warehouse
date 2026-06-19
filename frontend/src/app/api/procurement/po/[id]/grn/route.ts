import { NextRequest, NextResponse } from "next/server"

const BACKEND = process.env.BACKEND_URL ?? "https://nexora-warehouse.onrender.com"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const res = await fetch(`${BACKEND}/procurement/po/${id}/grn`, { method: "POST" })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

import { NextRequest, NextResponse } from "next/server"

const BACKEND = process.env.BACKEND_URL ?? "https://nexora-warehouse.onrender.com"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const res = await fetch(`${BACKEND}/procurement/payment/${id}`)
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

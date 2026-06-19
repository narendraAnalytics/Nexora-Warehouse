import { NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL ?? "https://nexora-warehouse.onrender.com"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const res = await fetch(`${BACKEND_URL}/procurement/pr/${id}/finance-analysis`)
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

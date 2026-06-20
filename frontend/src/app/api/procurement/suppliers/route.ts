import { NextResponse } from "next/server"

const BACKEND = process.env.BACKEND_URL ?? "https://nexora-warehouse.onrender.com"

export async function GET() {
  const res = await fetch(`${BACKEND}/procurement/suppliers`)
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

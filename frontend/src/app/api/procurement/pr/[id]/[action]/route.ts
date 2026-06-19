import { NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL ?? "https://nexora-warehouse.onrender.com"

const VALID_ACTIONS = ["approve", "reject", "request-changes", "resubmit"]

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const { id, action } = await params
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ detail: "Invalid action" }, { status: 400 })
  }
  const body = await req.json().catch(() => ({}))
  const res = await fetch(`${BACKEND_URL}/procurement/pr/${id}/${action}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

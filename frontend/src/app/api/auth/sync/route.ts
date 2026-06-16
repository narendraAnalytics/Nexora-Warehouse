import { NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    await getOrCreateUser()
  } catch {
    // Not authenticated or DB error — still redirect home
  }
  return NextResponse.redirect(new URL('/', req.url))
}

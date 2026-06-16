import { auth, currentUser } from '@clerk/nextjs/server'
import { sql } from './db'

export async function getOrCreateUser() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  // Fast path — check by clerk_id without fetching Clerk profile
  const existing = await sql`
    SELECT id, clerk_id, email, full_name, role
    FROM users
    WHERE clerk_id = ${userId}
  `
  if (existing.length > 0) return existing[0]

  // First login — fetch profile from Clerk (one network call)
  const clerkUser = await currentUser()
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? ''
  const fullName = clerkUser?.fullName ?? null

  const result = await sql`
    INSERT INTO users (clerk_id, email, full_name, role)
    VALUES (${userId}, ${email}, ${fullName}, 'ceo')
    ON CONFLICT (clerk_id) DO UPDATE
      SET email     = EXCLUDED.email,
          full_name = EXCLUDED.full_name
    RETURNING id, clerk_id, email, full_name, role
  `
  return result[0]
}

import { NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase-admin'
import { sendWelcome } from '@/lib/email'
import { query } from '@/lib/db'
import type { WelcomeRow } from '@/lib/types'

export async function POST(req: Request) {

  try {

    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

    const admin = getAdminAuth()
    const decoded = await admin.verifyIdToken(token, true)
    const uid = decoded.uid
    const email = decoded.email ?? null

    // upsert user and check if welcome email has been sent
    const welcomeResult = await query<WelcomeRow> (
      `INSERT INTO users (firebase_uid, email)
       VALUES ($1,$2)
       ON CONFLICT (email) DO UPDATE SET email=EXCLUDED.email
       RETURNING welcome_sent`,
      [uid, email],
    )
    const welcome_sent = welcomeResult.rows[0].welcome_sent

    // send a welcome email if it hasn't been sent
    if (!welcome_sent && email) {
      await sendWelcome(email)
      await query(
        `UPDATE users SET welcome_sent = true WHERE firebase_uid=$1`,
        [uid],
      )
    }

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}



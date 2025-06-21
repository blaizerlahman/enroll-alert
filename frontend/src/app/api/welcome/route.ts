import { NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase-admin'
import { sendWelcome } from '@/lib/email'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.POSTGRES_URL })
const EMAIL_FROM = process.env.EMAIL_FROM!

export async function POST(req: Request) {

  try {

    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

    const admin = getAdminAuth()
    const decoded = await admin.verifyIdToken(token, true)
    const uid = decoded.uid
    const email = decoded.email ?? null

    // upsert user and check if welcome email has been sent
    const {
      rows: [{ welcome_sent }],
    } = await pool.query(
      `INSERT INTO users (firebase_uid, email)
       VALUES ($1,$2)
       ON CONFLICT (firebase_uid) DO UPDATE SET email=EXCLUDED.email
       RETURNING welcome_sent`,
      [uid, email],
    )

    // send a welcome email if it hasn't been sent
    if (!welcome_sent && email) {
      await sendWelcome(email)
      await pool.query(
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



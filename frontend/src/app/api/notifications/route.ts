import { NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase-admin'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.POSTGRES_URL })

export async function POST(req: Request) {
  try {

    const adminAuth = getAdminAuth()
    const { token, courseId, sectionNum, alertType, seatThreshold } = await req.json()
    const decoded = await adminAuth.verifyIdToken(token, true)
    const firebaseUid = decoded.uid
    const email = decoded.email ?? null

    // validate inputs
    if (
      !['any', 'threshold'].includes(alertType) ||
      (alertType === 'threshold' && (!seatThreshold || seatThreshold < 1)) ||
      !Array.isArray(sectionNum) ||
      sectionNum.length === 0
    ) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    // upsert user and get their id
    const {
      rows: [{ id: userId }],
    } = await pool.query(
      `
      INSERT INTO users (firebase_uid, email)
      VALUES ($1, $2)
      ON CONFLICT (firebase_uid)
      DO UPDATE SET email = EXCLUDED.email
      RETURNING id
      `,
      [firebaseUid, email]
    )

    // get number of already existing alerts for the user
    const {
      rows: [{ count: existingAlerts }],
    } = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM user_courses
       WHERE user_id = $1`,
      [userId],
    );

    // check if adding selected alerts will put user over limit and return error if so
    if (existingAlerts + sectionNum.length > 20) {
      return NextResponse.json(
        { error: `You can only save up to 20 alerts (you have ${existingAlerts}).`},
        { status: 410}
      );
    }

    // check each selected section and return an error if any already exist
    // and return error if so
    for (const sec of sectionNum) {
      const { rows: [{ exists }] } = await pool.query<{ exists: boolean }>(
        `
        SELECT EXISTS(
          SELECT 1
          FROM user_courses
          WHERE user_id       = $1
            AND course_id     = $2
            AND section_num   = $3
            AND alert_type    = $4
            AND (seat_threshold IS NOT DISTINCT FROM $5)
        ) AS exists
        `,
        [userId, courseId, sec, alertType, seatThreshold ?? null]
      )
      if (exists) {
        return NextResponse.json(
          { error: 'You’ve already saved that exact alert.' },
          { status: 409 }
        )
      }

      // insert course alert into DB
      await pool.query(
        `
        INSERT INTO user_courses
               (user_id, course_id, section_num, alert_type, seat_threshold)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [userId, courseId, sec, alertType, seatThreshold ?? null]
      )
    }

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Unauthorized or server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {

    const adminAuth = getAdminAuth()
    const { token, courseId, sectionNum } = await req.json()
    const { uid: firebaseUid } = await adminAuth.verifyIdToken(token, true)

    const {
      rows: [{ id: userId }],
    } = await pool.query(
      `SELECT id FROM users WHERE firebase_uid = $1`,
      [firebaseUid]
    )

    await pool.query(
      `
      DELETE FROM user_courses
      WHERE user_id     = $1
        AND course_id   = $2
        AND section_num = ANY($3::text[])
      `,
      [userId, courseId, sectionNum]
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Unauthorized or server error' },
      { status: 500 }
    )
  }
}


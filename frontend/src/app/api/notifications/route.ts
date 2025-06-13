// src/app/api/notifications/route.ts
import { NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.POSTGRES_URL })

export async function POST(req: Request) {
  try {
    const {
      token,
      courseId,
      sectionNum,   
      alertType,     
      seatThreshold,  
    } = await req.json()

    const { uid: firebaseUid } = await adminAuth.verifyIdToken(token, true)

    if (
      !['any', 'threshold'].includes(alertType) ||
      (alertType === 'threshold' && (!seatThreshold || seatThreshold < 1)) ||
      !Array.isArray(sectionNum) ||
      sectionNum.length === 0
    ) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    const {
      rows: [{ id: userId }],
    } = await pool.query(
      `
        INSERT INTO users (firebase_uid)
        VALUES ($1)
        ON CONFLICT (firebase_uid)
        DO UPDATE SET firebase_uid = EXCLUDED.firebase_uid   -- no-op
        RETURNING id;
      `,
      [firebaseUid]
    )

    for (const section of sectionNum) {
      await pool.query(
        `
          INSERT INTO user_courses
                 (user_id, course_id, section_num,
                  alert_type, seat_threshold)
          VALUES   ($1,       $2,       $3,
                    $4,       $5)
          ON CONFLICT (user_id, course_id, section_num)
          DO UPDATE
             SET alert_type    = EXCLUDED.alert_type,
                 seat_threshold = EXCLUDED.seat_threshold,
                 created_at     = now();
        `,
        [userId, courseId, section, alertType, seatThreshold ?? null]
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


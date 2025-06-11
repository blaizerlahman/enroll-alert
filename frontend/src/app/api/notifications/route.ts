import { NextResponse } from 'next/server'
import { auth } from '@/lib/firebase'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.POSTGRES_URL })

export async function POST(req: Request) {
  try {
    const { uid } = await auth.verifyIdToken(
      (await req.json()).token, true 
    )

    const { courseId, sectionNum, alertType, seatThreshold } =
      await req.json()

    if (
      !['any', 'threshold'].includes(alertType) ||
      (alertType === 'threshold' && (seatThreshold ?? 0) < 1)
    ) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    await pool.query(
      `
      INSERT INTO user_courses
        (user_id, course_id, section_num, alert_type, seat_threshold)
      VALUES
        ($1,        $2,       $3,          $4,         $5)
      ON CONFLICT ON CONSTRAINT user_courses_user_id_course_id_section_num_key
      DO UPDATE
        SET alert_type = EXCLUDED.alert_type,
            seat_threshold = EXCLUDED.seat_threshold,
            created_at = now();
      `,
      [uid, courseId, sectionNum, alertType, seatThreshold],
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Unauthorized or server error' }, { status: 500 })
  }
}


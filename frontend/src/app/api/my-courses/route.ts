import { NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase-admin'
import { db } from '@/lib/db'

const TERM = parseInt(process.env.NEXT_PUBLIC_TERM ?? '1262', 10)

export async function GET(req: Request) {
  try {

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminAuth = getAdminAuth()
    const decoded = await adminAuth.verifyIdToken(token, true)
    const uid = decoded.uid
    const email = decoded.email || null

    const {
      rows: [{ id: userId }],
    } = await db.query(
      `
      INSERT INTO users (firebase_uid, email)
      VALUES ($1, $2)
      ON CONFLICT (firebase_uid)
      DO UPDATE SET
        email = EXCLUDED.email
      RETURNING id;
      `,
      [uid, email]
    )

    const { rows } = await db.query(
      `
      WITH alerts AS (
        SELECT course_id, section_num, alert_type, seat_threshold
        FROM user_courses
        WHERE user_id = $1
      ),
      secs AS (
        SELECT *
        FROM course_sections
        WHERE term = $2
      ),
      agg AS (
        SELECT course_id,
               SUM(open_seats)         AS total_open,
               SUM(enrolled)           AS total_enr,
               SUM(capacity)           AS total_cap,
               SUM(waitlist_open_spots) AS total_wl_open,
               SUM(waitlist_capacity)   AS total_wl_cap
        FROM secs
        WHERE section_type = 'LEC'
        GROUP BY course_id
      )
      SELECT
        s.course_id,
        s.course_name,
        s.course_title,
        ag.total_open,
        ag.total_enr,
        ag.total_cap,
        ag.total_wl_open,
        ag.total_wl_cap,
        json_agg(
          json_build_object(
            'section_num', a.section_num,
            'section_type', s.section_type,
            'open_seats',   s.open_seats,
            'capacity',     s.capacity,
            'enrolled',     s.enrolled,
            'waitlist_capacity',     s.waitlist_capacity,
            'waitlist_open_spots',   s.waitlist_open_spots,
            'alert_type',   a.alert_type,
            'seat_threshold',a.seat_threshold
          ) ORDER BY s.section_type, s.section_num
        ) AS alerts
      FROM alerts a
      JOIN secs s USING (course_id, section_num)
      JOIN agg  ag ON ag.course_id = s.course_id
      GROUP BY
        s.course_id,
        s.course_name,
        s.course_title,
        ag.total_open, ag.total_enr, ag.total_cap,
        ag.total_wl_open, ag.total_wl_cap
      ORDER BY s.course_name
      `,
      [userId, TERM]
    )

    return NextResponse.json(rows)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}


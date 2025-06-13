// app/api/my-courses/route.ts
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.POSTGRES_URL })
const TERM = parseInt(process.env.NEXT_PUBLIC_TERM ?? '1262', 10)

export async function GET(req: Request) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { uid } = await adminAuth.verifyIdToken(token, true)
    const { rows: [{ id: userId }] } = await pool.query(
      `
        INSERT INTO users (firebase_uid)
        VALUES ($1)
        ON CONFLICT (firebase_uid)
        DO UPDATE SET firebase_uid = EXCLUDED.firebase_uid
        RETURNING id;
      `,
      [uid]
    )

    const { rows } = await pool.query(
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
               SUM(open_seats)  AS total_open,
               SUM(enrolled)    AS total_enr,
               SUM(capacity)    AS total_cap,
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
      GROUP BY s.course_id, s.course_name, s.course_title,
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


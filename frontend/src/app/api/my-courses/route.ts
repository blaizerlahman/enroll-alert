import { NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase-admin'
import { query, CURR_TERM } from '@/lib/db'
import { IdRow } from '@/lib/types'

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

    const userInsert = await query<IdRow>(
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

    const userId = userInsert.rows[0].id;

    const alerts = await query(
      `
      WITH alerts AS (
        SELECT course_id, section_num, alert_type, seat_threshold, term
        FROM user_courses
        WHERE user_id = $1
      ),
      secs AS (
        SELECT *
        FROM course_sections
      ),
      agg AS (
        SELECT course_id,
               COUNT(*) AS total_sections,
               SUM(CASE WHEN course_status = 'OPEN' THEN 1 ELSE 0 END) AS open_sections,
               SUM(CASE WHEN course_status = 'WAITLISTED' THEN 1 ELSE 0 END) AS waitlisted_sections,
               SUM(CASE WHEN course_status = 'CLOSED' THEN 1 ELSE 0 END) AS closed_sections
        FROM secs
        WHERE section_type = 'LEC' OR section_type = 'FLD'
        GROUP BY course_id
      )
      SELECT
        s.course_id,
        s.course_name,
        s.course_title,
        a.term,
        ag.open_sections,
        ag.waitlisted_sections,
        ag.closed_sections,
        ag.total_sections,
        CASE
          WHEN ag.open_sections > 0 THEN 'OPEN'
          WHEN ag.waitlisted_sections > 0 THEN 'WAITLISTED'
          ELSE 'CLOSED'
        END AS course_status,
        json_agg(
          json_build_object(
            'section_num', a.section_num,
            'section_type', s.section_type,
            'open_seats',   s.open_seats,
            'capacity',     s.capacity,
            'enrolled',     s.enrolled,
            'waitlist_capacity',     s.waitlist_capacity,
            'waitlist_open_spots',   s.waitlist_open_spots,
            'course_status', s.course_status,
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
        a.term, 
        ag.open_sections, ag.waitlisted_sections, ag.closed_sections, ag.total_sections
      ORDER BY s.course_name
      `,
      [userId]
    );

    return NextResponse.json(alerts.rows)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}








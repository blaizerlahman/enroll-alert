import { NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase-admin'
import { query, CURR_TERM } from '@/lib/db'
import { IdRow, CountRow, ExistsRow } from '@/lib/types'

export async function POST(req: Request) {
  try {

    const adminAuth = getAdminAuth()
    const { token, courseId, sectionNum, alertType } = await req.json()
    const decoded = await adminAuth.verifyIdToken(token, true)
    const firebaseUid = decoded.uid
    const email = decoded.email ?? null

    // validate inputs
    if (
      alertType !== 'any' ||
      !Array.isArray(sectionNum) ||
      sectionNum.length === 0
    ) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    // confirm that each selected section is currently closed
    const closedCheck = await query<{ count: number }>(
      `
      SELECT COUNT(*)::int AS count
      FROM course_sections
      WHERE course_id = $1 AND term = $2 AND section_num = ANY($3::text[]) AND (course_status = 'CLOSED' OR course_status = 'WAITLISTED')
      `,
      [courseId, CURR_TERM, sectionNum]
    )
    const closedCount = closedCheck.rows[0].count
    if (closedCount !== sectionNum.length) {
      return NextResponse.json(
        { error: 'Alerts can only be created for sections that are currently CLOSED or WAITLISTED.' },
        { status: 409 }
      )
    }

    // upsert user and get their id
    const userResult = await query<IdRow>(
      `
      INSERT INTO users (firebase_uid, email)
      VALUES ($1, $2)
      ON CONFLICT (firebase_uid)
      DO UPDATE SET email = EXCLUDED.email
      RETURNING id
      `,
      [firebaseUid, email]
    )
    const userId = userResult.rows[0].id

    // get number of already existing alerts for the user
    const countResult = await query<CountRow>(
      `SELECT COUNT(*)::int AS count
       FROM user_courses
       WHERE user_id = $1`,
      [userId],
    )
    const existingAlerts = countResult.rows[0].count

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
      const existsResult = await query<ExistsRow>(
        `
        SELECT EXISTS(
          SELECT 1
          FROM user_courses
          WHERE user_id       = $1
            AND course_id     = $2
            AND section_num   = $3
            AND alert_type    = $4
        ) AS exists
        `,
        [userId, courseId, sec, alertType]
      )
      if (existsResult.rows[0].exists) {
        return NextResponse.json(
          { error: 'You’ve already saved that exact alert.' },
          { status: 409 }
        )
      }

      // insert course alert into DB
      await query(
        `
        INSERT INTO user_courses
          (user_id, course_id, section_num, alert_type)
        VALUES ($1, $2, $3, $4)
        `,
        [userId, courseId, sec, alertType]
      )

      // log course alert set (grab course name from courses since API doesn't provide it)
      await query(
        `
        INSERT INTO temp_logs
          (user_id, course_id, course_name, section_num, log_type)
        SELECT
          $1,
          $2,
          c.course_name,
          $3,
          $4
        FROM courses c
        WHERE c.course_id = $2
        ORDER BY c.term DESC
        LIMIT 1
        `,
        [userId, courseId, sec, "SET"]
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

    const userResult = await query<IdRow> (
      `SELECT id FROM users WHERE firebase_uid = $1`,
      [firebaseUid]
    )
    const userId = userResult.rows[0].id

    await query(
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


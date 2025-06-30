import { Pool, type QueryResult } from 'pg'
import pLimit from 'p-limit'

type GlobalPool = typeof global & {__dbPool?: Pool }
const g = global as GlobalPool

export const db = 
  g.__dbPool ?? 
  (g.__dbPool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 3_000,
    maxUses: 5_000,
  }))

const limit = pLimit(50);

export class PoolBusyError extends Error {
  constructor() {
    super('PgBouncer pool is full')
  }
}

type SqlParams = ReadonlyArray<string | number | null | boolean>

// query function that returns error and retries if max connections are reached
export async function query<T = unknown>(
  text: string,
  params: SqlParams = [],
  retries = 3,
): Promise<QueryResult<T>> {
  return limit(async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await db.query<T>(text, params)
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : String(err)

        const poolFull = /no more connections|too many connections|timeout exceeded/i.test(
          msg,
        )

        if (poolFull && attempt < retries) {
          await new Promise(r => setTimeout(r, 75 * (attempt + 1)))
          continue
        }
        if (poolFull) throw new PoolBusyError()
        throw err
      }
    }
  })
}

// get all subsections (lectures, discussions) for the given course ID
export async function getCourseSubsections(courseId: string) {
  const sql = `
    WITH lec AS (
      SELECT
        section_num::int AS lecture_num_int,
        section_num      AS lecture_num,
        course_id,
        COALESCE(prof_name, 'Unknown') AS professor,
        capacity, enrolled, open_seats,
        waitlist_capacity, waitlist_open_spots
      FROM course_sections
      WHERE course_id = $1 AND section_type = 'LEC'
    ),
    dis AS (
      SELECT
        section_num::int AS dis_num_int,
        section_num, section_type,
        capacity, enrolled, open_seats,
        waitlist_capacity, waitlist_open_spots,
        course_id
      FROM course_sections
      WHERE course_id = $1 AND section_type IN ('DIS','LAB','SEM')
    )
    SELECT
      l.*,                                  
      d.section_num   AS dis_section_num,    
      d.section_type  AS dis_section_type,
      d.capacity      AS dis_capacity,
      d.enrolled      AS dis_enrolled,
      d.open_seats    AS dis_open_seats,
      d.waitlist_capacity     AS dis_waitlist_capacity,
      d.waitlist_open_spots   AS dis_waitlist_open_spots
    FROM lec l
    LEFT JOIN dis d
      ON d.dis_num_int BETWEEN 300 + (l.lecture_num_int - 1) * 20 + 1
                        AND     300 +  l.lecture_num_int       * 20
    ORDER BY l.lecture_num, d.section_num;
  `
  const { rows } = await query(sql, [courseId])
  return rows
}

// get all courses that match the current filter (search, breadth, and subject)
export async function getFilteredCourses({
  search = '',
  breadths = [],
  subject = '',
  page = 1,
  perPage = 20,
}: {
  search?: string
  breadths?: string[]
  subject?: string
  page?: number
  perPage?: number
}) {
  const offset = (page - 1) * perPage

  const values = []
  const whereClauses = [`section_type = 'LEC'`]
  let orderByClause = ''


  if (search) {
    values.push(`%${search.toLowerCase()}%`)
    const searchIndex = values.length

    whereClauses.push(`
      (
        course_name ILIKE $${searchIndex}
        OR course_title ILIKE $${searchIndex}
        OR similarity(LOWER(course_name), LOWER($${searchIndex})) > 0.2
        OR similarity(LOWER(course_title), LOWER($${searchIndex})) > 0.2
      )
    `)

    orderByClause = `ORDER BY GREATEST(
      similarity(LOWER(course_name), LOWER($${searchIndex})),
      similarity(LOWER(course_title), LOWER($${searchIndex}))
    ) DESC`
  }

  if (subject) {
    values.push(`${subject} %`) 
    whereClauses.push(`course_name ILIKE $${values.length}`)
  }

  let breadthFilter = ''
  if (breadths.length > 0) {
    const breadthPlaceholders = breadths.map((_, i) => `$${values.length + i + 1}`)
    values.push(...breadths)
    breadthFilter = `
      HAVING ARRAY(
        SELECT cb.breadth_description
        FROM course_breadths cb
        WHERE cb.course_id = cs.course_id
      ) && ARRAY[${breadthPlaceholders.join(',')}]::text[]
    `
  }

  const baseQuery = `
    SELECT
      course_id,
      course_name,
      course_title,
      subject_id,
      SUM(open_seats) AS total_open_seats,
      SUM(capacity) AS total_capacity,
      SUM(enrolled) AS total_enrolled,
      SUM(waitlist_capacity) AS total_waitlist_capacity,
      SUM(waitlist_open_spots) AS total_waitlist_open,
      EXISTS (
        SELECT 1 FROM course_sections s2
        WHERE s2.course_id = cs.course_id AND s2.section_type IN ('DIS', 'LAB')
      ) AS has_subsections,
      ARRAY(
        SELECT cb.breadth_description
        FROM course_breadths cb
        WHERE cb.course_id = cs.course_id AND cb.breadth_description IS NOT NULL
      ) AS breadths
    FROM course_sections cs
    WHERE ${whereClauses.join(' AND ')}
    GROUP BY course_id, course_name, subject_id, course_title
    ${breadthFilter}
    ${orderByClause || 'ORDER BY course_name'}
  `

  const paginatedQuery = `
    WITH filtered AS (
      ${baseQuery}
    )
    SELECT * FROM filtered
    OFFSET $${values.length + 1}
    LIMIT $${values.length + 2}
  `

  values.push(offset, perPage)

  const result = await query(paginatedQuery, values)
  return result.rows
}

// get existing subject
export async function getSubjects() {
  const result = await query(`
    SELECT DISTINCT
      TRIM(REGEXP_REPLACE(course_name, '\\s\\d+.*$', '')) AS subject
    FROM course_sections
    WHERE course_name IS NOT NULL
    ORDER BY subject
  `)
  return result.rows.map(r => r.subject)
}


// get subsections for a given course_id
export async function getDiscussionSections(courseId: string) {
  const result = await query(`
    SELECT section_num, section_type, open_seats
    FROM course_sections
    WHERE section_type IN ('DIS', 'LAB', 'SEM') AND course_id = $1
    ORDER BY section_num
  `, [courseId])
  return result.rows
}

// get existing breadths
export async function getBreadths() {
  const result = await query(`
    SELECT DISTINCT breadth_description
    FROM course_breadths
    WHERE breadth_description IS NOT NULL
    ORDER BY breadth_description
  `)
  return result.rows.map(row => row.breadth_description)
}

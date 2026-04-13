import { Pool, type QueryResult, type QueryResultRow } from 'pg'
import type { Course } from '@/lib/types'
import pLimit from 'p-limit'
import { CURR_TERM } from '@/lib/terms'

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
export async function query<R extends QueryResultRow = QueryResultRow>(
  text: string,
  params: SqlParams = [],
  retries = 3,
): Promise<QueryResult<R>> {
  return limit(async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await db.query<R>(text, Array.from(params))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)

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
export async function getCourseSubsections(courseId: string, term: number) {
  const sql = `
    WITH lec AS (
      SELECT
        section_num::int AS lecture_num_int,
        section_num      AS lecture_num,
        course_id,
        COALESCE(prof_name, 'Unknown') AS professor,
        capacity, enrolled, open_seats,
        waitlist_capacity, waitlist_open_spots,
        course_status,
        term
      FROM course_sections
      WHERE course_id = $1 AND (section_type = 'LEC' OR section_type = 'FLD' OR section_type = 'SEM' OR section_type = 'LAB') AND term = $2
    ),
    dis AS (
      SELECT
        section_num::int AS dis_num_int,
        section_num, section_type,
        capacity, enrolled, open_seats,
        waitlist_capacity, waitlist_open_spots,
        course_id,
        course_status,
        term
      FROM course_sections
      WHERE course_id = $1 AND section_type IN ('DIS','LAB','SEM','FLD') and term = $2
    )
    SELECT
      l.*,
      d.section_num   AS dis_section_num,
      d.section_type  AS dis_section_type,
      d.capacity      AS dis_capacity,
      d.enrolled      AS dis_enrolled,
      d.open_seats    AS dis_open_seats,
      d.waitlist_capacity     AS dis_waitlist_capacity,
      d.waitlist_open_spots   AS dis_waitlist_open_spots,
      d.course_status         AS dis_course_status,
      d.term                  AS dis_term
    FROM lec l
    LEFT JOIN dis d
      ON d.course_id = l.course_id AND d.term = l.term
    ORDER BY l.lecture_num, d.section_num;
  `
  const { rows } = await query(sql, [courseId, term])
  return rows
}

// get all courses that match the current filter (search, breadth, and subject)
export async function getFilteredCourses<R extends QueryResultRow = Course>({
  search = '',
  breadths = [],
  subject = '',
  page = 1,
  perPage = 20,
  term = CURR_TERM,
}: {
  search?: string
  breadths?: string[]
  subject?: string
  page?: number
  perPage?: number
  term?: number
}): Promise<R[]> {
  const offset = (page - 1) * perPage

  const values: (string|number|null|boolean)[] = []
  const whereClauses: string[] = [`(cs.section_type = 'LEC' OR cs.section_type = 'FLD' OR cs.section_type = 'SEM' OR cs.section_type = 'LAB')`]
  let orderByClause = ''
  
  // require non-empty course title (usually empty course titles are grad school courses that don't get captured in initial run)
  whereClauses.push("TRIM(COALESCE(cs.course_title, '')) <> ''")

  if (search) {
    values.push(`%${search.toLowerCase()}%`)
    const searchIndex = values.length

    whereClauses.push(`
      (
        LOWER(cs.course_name) ILIKE LOWER($${searchIndex})
        OR LOWER(cs.course_title) ILIKE LOWER($${searchIndex})
        OR similarity(LOWER(cs.course_name), LOWER($${searchIndex})) > 0.2
        OR similarity(LOWER(cs.course_title), LOWER($${searchIndex})) > 0.2
      )
    `)

    orderByClause = `ORDER BY GREATEST(
      similarity(LOWER(cs.course_name), LOWER($${searchIndex})),
      similarity(LOWER(cs.course_title), LOWER($${searchIndex}))
    ) DESC`
  }

  if (subject) {
    values.push(`${subject} %`)
    whereClauses.push(`cs.course_name ILIKE $${values.length}`)
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

  values.push(term)
  whereClauses.push(`cs.term = $${values.length}`)

  const baseQuery = `
    SELECT
      cs.course_id,
      cs.course_name,
      cs.course_title,
      cs.subject_id,
      MAX(cas.total_sends) AS total_sends,
      MAX(cas.min_time_to_send) AS min_time_to_send,
      MAX(cas.max_time_to_send) AS max_time_to_send,
      MAX(cas.avg_time_to_send) AS avg_time_to_send,
      SUM(cs.open_seats) AS total_open_seats,
      SUM(cs.capacity) AS total_capacity,
      SUM(cs.enrolled) AS total_enrolled,
      SUM(cs.waitlist_capacity) AS total_waitlist_capacity,
      SUM(cs.waitlist_open_spots) AS total_waitlist_open,
      COUNT(*) AS total_sections_count,
      SUM(CASE WHEN cs.course_status = 'OPEN' THEN 1 ELSE 0 END) AS open_sections_count,
      SUM(CASE WHEN cs.course_status = 'WAITLISTED' THEN 1 ELSE 0 END) AS waitlisted_sections_count,
      SUM(CASE WHEN cs.course_status = 'CLOSED' THEN 1 ELSE 0 END) AS closed_sections_count,
      EXISTS (
        SELECT 1 FROM course_sections s2
        WHERE s2.course_id = cs.course_id AND s2.section_type IN ('DIS', 'LAB', 'SEM', 'FLD') AND s2.term = cs.term
      ) AS has_subsections,
      ARRAY(
        SELECT cb.breadth_description
        FROM course_breadths cb
        WHERE cb.course_id = cs.course_id AND cb.breadth_description IS NOT NULL
      ) AS breadths,
      CASE
        WHEN SUM(CASE WHEN cs.course_status = 'OPEN' THEN 1 ELSE 0 END) > 0 THEN 'OPEN'
        WHEN SUM(CASE WHEN cs.course_status = 'WAITLISTED' THEN 1 ELSE 0 END) > 0 THEN 'WAITLISTED'
        ELSE 'CLOSED'
      END AS course_status
    FROM course_sections cs
    LEFT JOIN course_send_stats cas
      ON cas.course_id = cs.course_id
      AND cas.subject_id = cs.subject_id
    WHERE ${whereClauses.join(' AND ')}
    GROUP BY cs.course_id, cs.course_name, cs.subject_id, cs.course_title, cs.term
    ${breadthFilter}
    ${orderByClause || 'ORDER BY cs.course_name'}
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

  const result = await query<R>(paginatedQuery, values)
  return result.rows
}


// get existing subject
export async function getSubjects(term: number) {
  const result = await query(`
    SELECT DISTINCT
      TRIM(REGEXP_REPLACE(course_name, '\\s\\d+.*$', '')) AS subject
    FROM course_sections cs
    WHERE cs.course_name IS NOT NULL AND cs.term = $1
    ORDER BY subject
  `, [term])
  return result.rows.map(r => r.subject)
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

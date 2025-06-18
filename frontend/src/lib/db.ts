import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

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
  const { rows } = await pool.query(sql, [courseId])
  return rows
}

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
    values.push(`${subject} %`) // "COMP SCI %" to match COMP SCI 300
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

  const result = await pool.query(paginatedQuery, values)
  return result.rows
}

export async function getSubjects() {
  const result = await pool.query(`
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
  const result = await pool.query(`
    SELECT section_num, section_type, open_seats
    FROM course_sections
    WHERE section_type IN ('DIS', 'LAB', 'SEM') AND course_id = $1
    ORDER BY section_num
  `, [courseId])
  return result.rows
}

export async function getBreadths() {
  const result = await pool.query(`
    SELECT DISTINCT breadth_description
    FROM course_breadths
    WHERE breadth_description IS NOT NULL
    ORDER BY breadth_description
  `)
  return result.rows.map(row => row.breadth_description)
}

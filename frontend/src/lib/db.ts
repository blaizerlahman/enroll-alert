// lib/db.ts
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

// get all LECs grouped by course_id
export async function getLectureCourses() {
  const result = await pool.query(`
    SELECT 
      course.course_id, 
      course.course_name, 
      course.subject_id,
      SUM(course.open_seats)           AS total_open_seats,
      SUM(course.capacity)             AS total_capacity,
      SUM(course.enrolled)             AS total_enrolled,
      SUM(course.waitlist_capacity)    AS total_waitlist_capacity,
      SUM(course.waitlist_open_spots)  AS total_waitlist_open,
      EXISTS (
          SELECT 1 FROM course_sections section
          WHERE section.course_id = course.course_id AND section.section_type IN ('DIS', 'LAB')
      ) AS has_subsections
    FROM course_sections course
    WHERE course.section_type = 'LEC'
    GROUP BY course.course_id, course.course_name, course.subject_id
    ORDER BY course.course_name
  `)
  return result.rows
}

// get DIS sections for a given course_id
export async function getDiscussionSections(courseId: string) {
  const result = await pool.query(`
    SELECT section_num, section_type, open_seats
    FROM course_sections
    WHERE section_type IN ('DIS', 'LAB') AND course_id = $1
    ORDER BY section_num
  `, [courseId])
  return result.rows
}


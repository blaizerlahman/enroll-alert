'use client'

import { useEffect, useState } from 'react'

type Course = {
  course_id: string
  course_name: string
  subject_id: number
  total_enrolled: number
  total_capacity: number
  total_open_seats: number
  total_waitlist_capacity: number
  total_waitlist_open: number
  has_subsections: boolean
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [sections, setSections] = useState<Record<string, any[]>>({})

  useEffect(() => {
    fetch('/api/lectures')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCourses(data)
        } else {
          console.error('Lecture API error:', data)
          setCourses([])
        }
      })
  }, [])

  const filtered = courses.filter(course =>
    course.course_name.toLowerCase().includes(search.toLowerCase()) &&
    (!subjectFilter || String(course.subject_id) === subjectFilter)
  )

  const toggle = async (courseId: string) => {
    if (expanded[courseId]) {
      setExpanded(prev => ({ ...prev, [courseId]: false }))
    } else {
      if (!sections[courseId]) {
        const res = await fetch(`/api/discussions/${courseId}`)
        const data = await res.json()
        setSections(prev => ({ ...prev, [courseId]: data }))
      }
      setExpanded(prev => ({ ...prev, [courseId]: true }))
    }
  }

  const subjects = Array.from(new Set(courses.map(c => c.subject_id).filter(Boolean)))

  return (
    <main className="p-6 space-y-4">
      <div className="flex flex-wrap gap-4 items-center mb-6">
        <input
          type="text"
          placeholder="Search by course name"
          className="border p-2 rounded w-full sm:w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border p-2 rounded"
          value={subjectFilter ?? ''}
          onChange={(e) =>
            setSubjectFilter(e.target.value || null)
          }
        >
          <option value="">All Subjects</option>
          {subjects.map(id => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </div>

      {filtered.map(course => (
        <div key={course.course_id} className="border rounded-lg shadow p-4 space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">{course.course_name}</h2>
            {course.has_subsections &&  (
              <button
                onClick={() => toggle(course.course_id)}
                className="text-sm bg-blue-500 text-white px-2 py-1 rounded"
              >
                {expanded[course.course_id] ? 'Hide Sections' : 'Show Sections'}
              </button>
            )}
          </div>
          <p>Enrolled: {course.total_enrolled} / {course.total_capacity}</p>
          <p>Open Seats: {course.total_open_seats}</p>
          <p>Waitlist: {course.total_waitlist_open} / {course.total_waitlist_capacity}</p>

          {expanded[course.course_id] && (
            <ul className="ml-4 mt-2 list-disc">
              {Array.isArray(sections[course.course_id]) && sections[course.course_id].length > 0 ? (
                sections[course.course_id].map((sec, idx) => (
                  <li key={idx}>
                    {sec.section_type} {sec.section_num} — Open Seats: {sec.open_seats}
                  </li>
                ))
              ) : (
                <li>No subsections available</li>
              )}
            </ul>
          )}
        </div>
      ))}
    </main>
  )
}


'use client'

import { useEffect, useState } from 'react'

type Lecture = {
  course_id:        string
  course_name:      string
  total_open_seats: number
}

type Subsection = {
  section_num:  string
  open_seats:   number
  section_type: string
}

export default function CoursesPage() {
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [subsections, setSubsections] = useState<Record<string, Section[]>>({})

  useEffect(() => {
    fetch('/api/lectures')
      .then(res => res.json())
      .then(setLectures)
  }, [])

  const toggleSubsections = async (courseId: string) => {
    if (expanded[courseId]) {
      setExpanded(prev => ({ ...prev, [courseId]: false }))
    } else {
      // only fetch if not already loaded
      if (!subsections[courseId]) {
        const res = await fetch(`/api/discussions/${courseId}`)
        const data = await res.json()
        console.log('Fetched subsections:', data)
        setSubsections(prev => ({ ...prev, [courseId]: data }))
      }
      setExpanded(prev => ({ ...prev, [courseId]: true }))
    }
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Courses</h1>
      <ul>
        {lectures.map(lec => (
          <li key={lec.course_id} className="mb-4 border p-4 rounded">
            <div className="flex justify-between items-center">
              <span>
                <strong>{lec.course_name}</strong> — Open Seats: {lec.total_open_seats}
              </span>
              <button
                className="bg-blue-500 text-white px-3 py-1 rounded"
                onClick={() => toggleSubsections(lec.course_id)}
              >
                {expanded[lec.course_id] ? 'Hide Subsections' : 'Show Subsections'}
              </button>
            </div>

            {expanded[lec.course_id] && Array.isArray(subsections[lec.course_id]) && (
              <ul className="mt-3 pl-4">
                {subsections[lec.course_id].length === 0 ? (
                  <li>No discussions or labs</li>
                ) : (
                  subsections[lec.course_id].map((sec, i) => (
                    <li key={i}>
                    {sec.section_type} {sec.section_num} — Open Seats: {sec.open_seats}
                    </li>
                  ))
                )}
              </ul>
            )}

            {expanded[lec.course_id] && !Array.isArray(subsections[lec.course_id]) && (
              <p className="text-red-500 mt-2">Error loading discussion data.</p>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}


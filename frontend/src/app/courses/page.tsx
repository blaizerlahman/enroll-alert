import CoursesClient from './page.client'
import { getFilteredCourses, getSubjects, getBreadths } from '@/lib/db'
import type { Course } from '@/lib/types'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: "Course Tracker - EnrollAlert",
  description: "Real-time seat availability for UW-Madison courses. Get notified the moment a seat opens.",
  aleternates: { canonical: "/courses"},
}

export default async function Page() {
  const perPage  = 20

  const [courses, subjects, breadths] = await Promise.all([
    getFilteredCourses<Course>({         
      search:    '',
      subject:   '',
      breadths:  [],
      page:      1,
      perPage,
    }),
    getSubjects(),
    getBreadths(),
  ])

  return (
    <CoursesClient
      initialCourses={courses}
      initialSubjects={subjects}
      initialBreadths={breadths}
      perPage={perPage}
    />
  )
}

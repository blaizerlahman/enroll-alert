import CoursesClient from './page.client'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

function getBaseUrl() {
  const vercel = process.env.VERCEL_URL
  if (vercel) return `https://${vercel}`

  return 'http://localhost:3000'
}

export default async function Page() {
  const base = getBaseUrl()
  const perPage  = 20
  const cookieHeader = cookies().toString()

  const [courses, subjects, breadths] = await Promise.all([
    fetch(`${base}/api/courses?page=1&perPage=${perPage}`, {
      headers: { cookie: cookieHeader },
    }).then(r => r.json()),
    fetch(`${base}/api/subjects`, { headers: { cookie: cookieHeader } }).then(r => r.json()),
    fetch(`${base}/api/breadths`, { headers: { cookie: cookieHeader } }).then(r => r.json()),
  ])

  return (
    <CoursesClient
      initialCourses={Array.isArray(courses)  ? courses  : []}
      initialSubjects={Array.isArray(subjects) ? subjects : []}
      initialBreadths={Array.isArray(breadths) ? breadths : []}
      perPage={perPage}
    />
  )
}


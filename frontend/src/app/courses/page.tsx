import CoursesClient from './page.client'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

const INTERNAL = process.env.INTERNAL_API_KEY!

async function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`

  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

export default async function Page() {
  const base = await getBaseUrl()
  const perPage  = 20

  const [courses, subjects, breadths] = await Promise.all([
    fetch(`${base}/api/courses?page=1&perPage=${perPage}`, {
      headers: { 'X-Internal-Request': INTERNAL },
    }).then(r => r.json()),
    fetch(`${base}/api/subjects`, { headers: { 'X-Internal-Request': INTERNAL }, }).then(r => r.json()),
    fetch(`${base}/api/breadths`, { headers: { 'X-Internal-Request': INTERNAL } }).then(r => r.json()),
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

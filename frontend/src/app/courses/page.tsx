import CoursesClient from './page.client'

export const dynamic = 'force-dynamic'

function getBaseUrl() {
  const vercel = process.env.VERCEL_URL
  if (vercel) return `https://${vercel}`

  return 'http://localhost:3000'
}

async function safeJson(label: string, res: Response) {
  if (!res.ok) {
    console.error(`${label} → ${res.status}`)
    throw new Error(`${label} failed`)
  }
  return res.json().catch(e => {
    console.error(`${label} parse error`, e)
    throw e
  })
}

export default async function Page() {
  const base     = getBaseUrl()
  const perPage  = 20

  const [coursesRes, subjectsRes, breadthsRes] = await Promise.all([
    fetch(`${base}/api/courses?page=1&perPage=${perPage}`),
    fetch(`${base}/api/subjects`),
    fetch(`${base}/api/breadths`),
  ])

  const [courses, subjects, breadths] = await Promise.all([
    safeJson('courses', coursesRes),
    safeJson('subjects', subjectsRes),
    safeJson('breadths', breadthsRes),
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


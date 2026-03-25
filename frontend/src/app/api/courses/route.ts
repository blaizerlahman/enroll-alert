import { getFilteredCourses, PoolBusyError } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { CURR_TERM } from '@/lib/terms.ts'

export const revalidate = 300

export async function GET(req: NextRequest) {

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const subject = searchParams.get('subject') || ''
  const breadths = searchParams.get('breadths')
    ? searchParams.get('breadths')!.split(',')
    : []
  const page = parseInt(searchParams.get('page') || '1', 10)
  const perPage = parseInt(searchParams.get('perPage') || '25', 10)

  try {

    const term = parseInt(searchParams.get('term') ?? String(CURR_TERM), 10)

    const courses = await getFilteredCourses({
      search,
      subject,
      breadths,
      page,
      perPage,
      term,
    })

    return NextResponse.json(courses, {
      headers: {
        'Cache-Control':
          page === 1
            ? 'public, s-maxage=300, stale-while-revalidate=300'
            : 'no-store',
      },
    })
  } catch (err) {
    if (err instanceof PoolBusyError)
      return NextResponse.json({ error: 'busy' }, { status: 503 })
    console.error('Failed to fetch filtered courses:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}


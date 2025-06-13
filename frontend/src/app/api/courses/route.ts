import { getFilteredCourses } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

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
    const courses = await getFilteredCourses({
      search,
      subject,
      breadths,
      page,
      perPage,
    })
    return NextResponse.json(courses)
  } catch (err) {
    console.error('Failed to fetch filtered courses:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}


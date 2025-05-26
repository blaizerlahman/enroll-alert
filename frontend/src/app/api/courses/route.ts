// app/api/courses/route.ts
import { getCourses } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const courses = await getCourses()
    return NextResponse.json(courses)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 })
  }
}


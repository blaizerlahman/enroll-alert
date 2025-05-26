// app/api/lectures/route.ts
import { getLectureCourses } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const data = await getLectureCourses()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load lectures' }, { status: 500 })
  }
}


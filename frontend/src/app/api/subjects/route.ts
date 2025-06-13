import { getSubjects } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const subjects = await getSubjects()
    return NextResponse.json(subjects)
  } catch (err) {
    console.error('Failed to fetch subjects:', err)
    return NextResponse.json({ error: 'Failed to fetch subjects' }, { status: 500 })
  }
}


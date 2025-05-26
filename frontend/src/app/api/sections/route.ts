// app/api/sections/route.ts
import { getSectionOpenings } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const sections = await getSectionOpenings()
    return NextResponse.json(sections)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch sections' }, { status: 500 })
  }
}


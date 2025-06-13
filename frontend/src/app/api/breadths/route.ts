// app/api/breadths/route.ts
import { getBreadths } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const breadths = await getBreadths()
    return NextResponse.json(breadths)
  } catch (err) {
    console.error('Failed to fetch breadths:', err)
    return NextResponse.json({ error: 'Failed to fetch breadths' }, { status: 500 })
  }
}


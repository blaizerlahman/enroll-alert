import { NextResponse } from 'next/server'
import { getDiscussionSections } from '@/lib/db'

export async function GET(req: Request) {         
  const id = req.url.split('/').pop()!           
  try {
    return NextResponse.json(await getDiscussionSections(id))
  } catch (err) {
    console.error('Failed to load discussions for', id, err)
    return NextResponse.json(
      { error: 'Failed to load discussions' },
      { status: 500 }
    )
  }
}


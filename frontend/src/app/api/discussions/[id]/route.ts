import { getDiscussionSections } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params  // no need to await context
    const data = await getDiscussionSections(id)
    return NextResponse.json(data)
  } catch (err) {
    console.error('API error for course ID', context.params.id, ':', err)
    return NextResponse.json({ error: 'Failed to load discussions' }, { status: 500 })
  }
}


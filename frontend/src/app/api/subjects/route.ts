import { getSubjects, PoolBusyError } from '@/lib/db'
import { NextResponse } from 'next/server'
import { CURR_TERM } from '@/lib/terms.ts'

export const revalidate = 86_400      

export async function GET(req: Request) {
  try {

    const term = parseInt(new URL(req.url).searchParams.get('term') ?? String(CURR_TERM), 10)

    const subjects = await getSubjects(term)

    return NextResponse.json(subjects, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    if (err instanceof PoolBusyError)
      return NextResponse.json({ error: 'busy' }, { status: 503 })
    console.error('Failed to fetch subjects:', err)
    return NextResponse.json(
      { error: 'Failed to fetch subjects' },
      { status: 500 },
    )
  }
}

import { getBreadths, PoolBusyError } from '@/lib/db'
import { NextResponse } from 'next/server'

export const revalidate = 86_400

export async function GET() {
  try {
    const breadths = await getBreadths()
    
    return NextResponse.json(breadths, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    if (err instanceof PoolBusyError)
      return NextResponse.json({ error: 'busy' }, { status: 503 })

    console.error('Failed to fetch breadths:', err)

    return NextResponse.json(
      { error: 'Failed to fetch breadths' },
      { status: 500 },
    )
  }
}


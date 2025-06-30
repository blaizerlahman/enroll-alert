import { NextResponse, type NextRequest } from 'next/server'
import { RateLimiterMemory } from 'rate-limiter-flexible'

const limiter = new RateLimiterMemory({ points: 40, duration: 60 })

// prevent any API call spam with more than 40 calls within a minute
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // keep track of any calls to notifications DELETE endpoint, or sections/discussions APIs
  if (
    (pathname === '/api/notifications' && req.method === 'DELETE') ||
    pathname.startsWith('/api/sections') ||
    pathname.startsWith('/api/discussions')
  ) {
    try {
      const ip = (req as any).ip ?? req.headers.get('x-forwarded-for') ?? 'unknown'
      await limiter.consume(ip)
    } catch {
      return new NextResponse('Too Many Requests', { status: 429 })
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/sections/:path*',
    '/api/discussions/:path*',
    '/api/notifications'   
  ],
}


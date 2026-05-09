import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
const PUBLIC = ['/login','/accept-invite']
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname === '/') return NextResponse.redirect(new URL('/dashboard', req.url))
  return NextResponse.next()
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'] }

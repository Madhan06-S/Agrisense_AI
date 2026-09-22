import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value || 
                request.cookies.get('user_role')?.value ||
                request.headers.get('authorization')?.replace('Bearer ', '');
  
  const pathname = request.nextUrl.pathname;
  
  // Public routes
  if (pathname === '/login' || pathname === '/' || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Dashboard route authentication check
  if (!token && pathname.startsWith('/dashboard')) {
    // Check if request is direct navigation or initial load; if no token or role cookie, redirect to login
    const isDirectNav = request.headers.get('accept')?.includes('text/html');
    if (isDirectNav && !request.cookies.has('access_token') && !request.cookies.has('user_role')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login']
};

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value || 
                request.headers.get('authorization')?.replace('Bearer ', '');
  
  // For client-side routing, we check localStorage in components
  // This middleware handles server-side and initial loads
  const pathname = request.nextUrl.pathname;
  
  // Public routes
  if (pathname === '/login' || pathname === '/' || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // If no token, redirect to login
  if (!token && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login']
};

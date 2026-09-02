import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, getSessionFromRequest } from './lib/session';

export { getSessionFromRequest };

export const config = {
  matcher: ['/admin/:path*', '/[slug]/dashboard/:path*'],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = getSessionFromRequest(request);

  if (!token) {
    const loginUrl = pathname.startsWith('/admin') 
      ? '/?mode=admin' 
      : '/';
    return NextResponse.redirect(new URL(loginUrl, request.url));
  }

  const payload = await verifySessionToken(token);
  if (!payload) {
    const loginUrl = pathname.startsWith('/admin') 
      ? '/?mode=admin&error=expired' 
      : '/';
    return NextResponse.redirect(new URL(loginUrl, request.url));
  }

  // For admin routes, verify super_admin type
  if (pathname.startsWith('/admin') && payload.userType !== 'super_admin') {
    return NextResponse.redirect(new URL('/?mode=admin&error=forbidden', request.url));
  }

  // For tenant routes, verify tenant type and matching slug
  if (pathname.startsWith('/')) {
    const slugMatch = pathname.match(/^\/([a-z0-9-]+)/);
    if (slugMatch) {
      const urlSlug = slugMatch[1];
      if (payload.userType === 'tenant' && payload.tenantSlug !== urlSlug) {
        return NextResponse.redirect(new URL(`/${payload.tenantSlug}/dashboard`, request.url));
      }
    }
  }

  // Inject user info into headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.userId);
  requestHeaders.set('x-user-type', payload.userType);
  if (payload.tenantId) requestHeaders.set('x-tenant-id', payload.tenantId);
  if (payload.tenantSlug) requestHeaders.set('x-tenant-slug', payload.tenantSlug);
  requestHeaders.set('x-user-role', payload.role || '');

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

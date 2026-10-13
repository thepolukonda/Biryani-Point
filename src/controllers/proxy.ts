/**
 * Front controller for every page request (src/proxy.ts): language routing for the
 * customer site; for /admin, a fresh staff session cookie and the login redirect.
 */
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/config/i18n/routing';
import { isSignedIn } from '@/model-helpers/staff/session';

const intl = createMiddleware(routing);

/** Keeps the staff session cookie fresh and sends signed-out visitors to the login page. */
async function adminProxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const signedIn = await isSignedIn({
    getAll: () => request.cookies.getAll(),
    setAll: (list) => {
      for (const { name, value } of list) request.cookies.set(name, value);
      response = NextResponse.next({ request });
      for (const { name, value, options } of list) response.cookies.set(name, value, options);
    },
  });
  const isLogin = request.nextUrl.pathname === '/admin/login';
  if (!signedIn && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  // The admin panel is never cached or indexed.
  response.headers.set('x-robots-tag', 'noindex, nofollow');
  response.headers.set('cache-control', 'no-store');
  return response;
}

export function handleRequest(request: NextRequest) {
  if (request.nextUrl.pathname === '/admin' || request.nextUrl.pathname.startsWith('/admin/')) {
    return adminProxy(request);
  }
  return intl(request);
}

import { createServerClient } from '@supabase/ssr';
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

/** Keeps the staff session cookie fresh and sends signed-out visitors to the login page. */
async function adminProxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();
  const isLogin = request.nextUrl.pathname === '/admin/login';
  if (!data.user && !isLogin) {
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

export default function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/admin' || request.nextUrl.pathname.startsWith('/admin/')) {
    return adminProxy(request);
  }
  return intl(request);
}

export const config = {
  // Everything except API routes, Next internals, generated icons and files with an extension.
  matcher: ['/((?!api|_next|_vercel|icon$|icons|apple-icon|.*\\..*).*)'],
};

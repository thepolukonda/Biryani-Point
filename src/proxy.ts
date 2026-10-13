/** Runs before every page request; see the front controller in controllers/proxy.ts. */
import { handleRequest } from '@/controllers/proxy';

export default handleRequest;

export const config = {
  // Everything except API routes, Next internals, generated icons and files with an extension.
  matcher: ['/((?!api|_next|_vercel|icon$|icons|apple-icon|.*\\..*).*)'],
};

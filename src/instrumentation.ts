/** Server-side error hook: every unhandled request error goes to reportError (and Sentry if configured). */
import type { Instrumentation } from 'next';
import { reportError } from '@/lib/monitoring';

export function register() {
  // Nothing to set up: monitoring needs no SDK.
}

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  reportError(error, {
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    routePath: context.routePath,
  });
};

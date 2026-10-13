/**
 * The database connection for the Model layer. Only files in src/models import this.
 *
 *  publicDb()   publishable key, no cookies: public reads (menu, hours). Cacheable.
 *  staffDb()    the signed-in staff member's session: the database's RLS rules apply.
 *  serviceDb()  secret key, bypasses RLS: order creation, Sheet import, staff accounts.
 *
 * Model functions take the client as their first argument, so the Model Helper that
 * calls them decides whose permissions a query runs with.
 */
import 'server-only';

export { publicClient as publicDb, serviceClient as serviceDb } from './clients';
export { sessionClient as staffDb } from './session';
export * from './core';

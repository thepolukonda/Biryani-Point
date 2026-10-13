/**
 * Shared pieces of the Model layer, safe in the browser too: the client type and errors.
 * Server code gets its clients from ./index; the kitchen screen from ./browser.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type Db = SupabaseClient<Database>;
export type Tables = Database['public']['Tables'];
export type Enums = Database['public']['Enums'];
export type Row<T extends keyof Tables> = Tables[T]['Row'];
export type Insert<T extends keyof Tables> = Tables[T]['Insert'];
export type Update<T extends keyof Tables> = Tables[T]['Update'];
export type { Database, Json } from './database.types';

type PgError = { message: string; code?: string };

/** A failed query. `has('not_paid')` checks for a marker raised by a database rule. */
export class DbError extends Error {
  readonly code: string | undefined;
  /** The database's own message, without the "where" prefix. */
  readonly detail: string;

  constructor(
    readonly where: string,
    cause: PgError,
  ) {
    super(`${where}: ${cause.message}`, { cause });
    this.name = 'DbError';
    this.code = cause.code;
    this.detail = cause.message;
  }

  has(marker: string): boolean {
    return this.message.includes(marker);
  }

  /** Postgres unique_violation. */
  get isDuplicate(): boolean {
    return this.code === '23505';
  }
}

/** The data of a query, or throws DbError. */
export function must<T>(result: { data: T | null; error: PgError | null }, where: string): T {
  if (result.error) throw new DbError(where, result.error);
  if (result.data === null) throw new DbError(where, { message: 'no data' });
  return result.data;
}

/** Throws DbError when a write failed. */
export function check(result: { error: PgError | null }, where: string): void {
  if (result.error) throw new DbError(where, result.error);
}

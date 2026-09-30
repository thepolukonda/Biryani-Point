import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { serverEnv } from '@/lib/env.server';

/** Best guess at the visitor's IP on Netlify, Cloudflare or a plain proxy. */
export function clientIp(headers: Headers): string {
  return (
    headers.get('x-nf-client-connection-ip') ??
    headers.get('cf-connecting-ip') ??
    headers.get('x-real-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

/** Salted hash, so raw IP addresses are never stored. */
export function hashIp(ip: string): string {
  return createHash('sha256')
    .update(serverEnv().IP_HASH_SALT)
    .update(ip)
    .digest('hex')
    .slice(0, 32);
}

/** Unguessable id for tracking links: 16 random bytes as 22 URL-safe characters. */
export function newPublicId(): string {
  return randomBytes(16).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { securityHeaders } from '../../security-headers';

const root = path.join(__dirname, '..', '..');

describe('netlify.toml', () => {
  it('has exactly the security headers from security-headers.ts', () => {
    const toml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
    for (const { key, value } of securityHeaders()) {
      expect(toml, `${key} differs; run npm run netlify:toml`).toContain(
        `${key} = ${JSON.stringify(value)}`,
      );
    }
  });
});

describe('translations', () => {
  const keys = (o: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? keys(v as Record<string, unknown>, `${prefix}${k}.`)
        : [`${prefix}${k}`],
    );
  const load = (l: string) =>
    JSON.parse(fs.readFileSync(path.join(root, 'messages', `${l}.json`), 'utf8'));
  const en = keys(load('en')).sort();

  it.each(['ka', 'ru'])('%s has the same keys as English', (locale) => {
    expect(keys(load(locale)).sort()).toEqual(en);
  });

  it.each(['en', 'ka', 'ru'])('%s has no empty strings', (locale) => {
    const flat = (o: Record<string, unknown>): unknown[] =>
      Object.values(o).flatMap((v) =>
        v && typeof v === 'object' && !Array.isArray(v) ? flat(v as Record<string, unknown>) : [v],
      );
    expect(flat(load(locale)).filter((v) => v === '')).toEqual([]);
  });
});

describe('business details', () => {
  // These come from the business profile in the database (Admin → Settings), so they must
  // not be written into the code or the translation files.
  const FORBIDDEN = [
    /Biryani Point/i,
    /Khimshiashvili|ხიმშიაშვილ|Химшиашвили/,
    /500\s?90\s?47\s?21|500904721/,
    /\bBATUMI\b/,
  ];
  const files = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return files(p);
      return /\.(tsx?|json|svg)$/.test(e.name) && !/\.test\.|fixture/.test(e.name) ? [p] : [];
    });
  const withoutComments = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('are not hardcoded in src/ or messages/', () => {
    const hits = [...files(path.join(root, 'src')), ...files(path.join(root, 'messages'))]
      .filter((f) => !f.endsWith('database.types.ts'))
      .flatMap((f) => {
        const text = withoutComments(fs.readFileSync(f, 'utf8'));
        return FORBIDDEN.filter((re) => re.test(text)).map(
          (re) => `${path.relative(root, f)}: ${re}`,
        );
      });
    expect(hits).toEqual([]);
  });
});

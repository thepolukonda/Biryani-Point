import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/** Forbids (non-type) imports of `banned` in `files`. */
const layer = (message, files, banned) => ({
  files,
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      { patterns: [{ group: banned, message, allowTypeImports: true }] },
    ],
  },
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // `_name` marks a value that is intentionally unused (e.g. when omitting a key).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
  // MVC layers: View -> Controller -> Model Helper -> Model. Each layer imports only the
  // layer below it (plus src/shared and src/config). Type-only imports are allowed anywhere.
  layer(
    'Views and routes go through a controller.',
    ['src/app/**', 'src/views/**', 'src/config/**', 'src/proxy.ts'],
    ['@/model-helpers/*', '@/models/*', '@supabase/*'],
  ),
  layer(
    'Controllers call a Model Helper, never the database.',
    ['src/controllers/**'],
    ['@/models/*', '@supabase/*', '@/views/*', '@/app/*'],
  ),
  layer(
    'Model Helpers are called by controllers, not the other way round.',
    ['src/model-helpers/**'],
    ['@/controllers/*', '@/views/*', '@/app/*', '@supabase/*'],
  ),
  layer(
    'Models only talk to the database.',
    ['src/models/**'],
    ['@/model-helpers/*', '@/controllers/*', '@/views/*', '@/app/*'],
  ),
  layer(
    'Shared code is used by every layer, so it imports none of them.',
    ['src/shared/**'],
    ['@/model-helpers/*', '@/models/*', '@/controllers/*', '@/views/*', '@/app/*', '@supabase/*'],
  ),
  {
    // Node scripts (seed, sync) may use require-style patterns and console output.
    files: ['scripts/**/*.{ts,mjs}'],
    rules: { 'no-console': 'off' },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'src/models/db/database.types.ts',
  ]),
]);

export default eslintConfig;

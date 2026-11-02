import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('checks permission specificity, DENY isolation, staff RLS and rollback on PostgreSQL', () => {
  const output = execFileSync(process.execPath, [
    join(__dirname, '../supabase/drafts/permission-argument-shadowing/run-fixtures.mjs'),
  ], {
    env: { ...process.env, PGLITE_MODULE: require.resolve('@electric-sql/pglite') },
    encoding: 'utf8',
    timeout: 30_000,
  });
  expect(output).toContain('PASS 23 PostgreSQL fixtures');
}, 35_000);

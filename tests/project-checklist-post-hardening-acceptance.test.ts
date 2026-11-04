import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('executes checklist creation/template and staff stale-identity acceptance on disposable PostgreSQL', () => {
  const output = execFileSync(process.execPath, [
    join(__dirname, '../supabase/drafts/project-checklist/test.mjs'),
  ], {
    env: { ...process.env, PGLITE_MODULE: require.resolve('@electric-sql/pglite') },
    encoding: 'utf8',
    timeout: 30_000,
  });
  expect(output).toContain('PASS: 8 checklist acceptance cases');
  expect(output).toContain('guarded forward and data-preserving rollback');
}, 35_000);

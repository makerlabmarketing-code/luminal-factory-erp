import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('project UI wave one', () => {
  it('shares page-level presentation patterns across project list and detail', () => {
    const patterns = source('component/project/ProjectPagePatterns.tsx');
    const list = source('app/admin/projects/page.tsx');
    const detail = source('app/admin/projects/[projectId]/page.tsx');

    expect(patterns).toMatch(/ProjectPageHeader/);
    expect(patterns).toMatch(/ProjectMetricCard/);
    expect(patterns).toMatch(/ProjectPanel/);
    expect(list).toMatch(/ProjectPageHeader/);
    expect(list).toMatch(/ProjectMetricCard/);
    expect(list).toMatch(/ProjectPanel/);
    expect(detail).toMatch(/ProjectPageHeader/);
    expect(detail).toMatch(/ProjectPanel/);
  });

  it('keeps the list readable on narrow screens without removing the desktop table', () => {
    const list = source('app/admin/projects/page.tsx');

    expect(list).toMatch(/hidden overflow-x-auto md:block/);
    expect(list).toMatch(/divide-y divide-slate-800 md:hidden/);
    expect(list).toMatch(/line-clamp-2/);
    expect(list).toMatch(/healthLabels/);
  });

  it('uses an internal loader with no external player or network asset', () => {
    const loader = source('component/LuminalLoader.tsx');
    const manifest = source('package.json');

    expect(loader).not.toMatch(/lottiefiles|https?:\/\//i);
    expect(manifest).not.toMatch(/lottie-react|@lottiefiles/i);
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function source(path: string) {
  return readFileSync(path, 'utf8');
}

describe('dev visual monitoring documentation', () => {
  it('documents the workflow and stops browser automation at the approval gate', () => {
    const docs = source('docs/DEV_VISUAL_MONITORING.md');
    const pkg = JSON.parse(source('package.json')) as { scripts: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const gitignore = source('.gitignore');

    expect(docs).toMatch(/Agent Eye/);
    expect(docs).toMatch(/coding-by-feng\/ai-agent-session-center/);
    expect(docs).toMatch(/TOOLING_APPROVAL_REQUIRED/);
    expect(docs).toMatch(/No safe checked-in browser auth fixture was found/);
    expect(docs).toMatch(/Codex Cloud may not provide installed browser automation packages or browser binaries/);
    expect(docs).toMatch(/\.artifacts\/screenshots/);
    expect(docs).toMatch(/npm install --save-dev playwright/);
    expect(pkg.scripts['agent:monitor']).toBe('node scripts/agent-monitor.mjs');
    expect(pkg.scripts['ui:screenshot']).toBe('node scripts/ui-screenshot.mjs');
    expect(pkg.scripts['ui:verify']).toBe('node scripts/ui-screenshot.mjs --verify');
    expect(pkg.dependencies?.playwright).toBeUndefined();
    expect(pkg.dependencies?.cypress).toBeUndefined();
    expect(pkg.devDependencies?.playwright).toBeUndefined();
    expect(pkg.devDependencies?.cypress).toBeUndefined();
    expect(gitignore).toMatch(/\.artifacts\//);
    expect(gitignore).toMatch(/playwright-report\//);
    expect(gitignore).toMatch(/\.auth\//);
  });
});

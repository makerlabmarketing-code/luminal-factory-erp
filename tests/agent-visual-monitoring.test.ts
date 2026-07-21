import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function source(path: string) {
  return readFileSync(path, 'utf8');
}

describe('dev-only agent visual monitoring workflow', () => {
  it('documents local monitoring and keeps screenshot artifacts ignored', () => {
    const docs = source('docs/agent-visual-monitoring.md');
    const gitignore = source('.gitignore');

    expect(docs).toMatch(/Agent Eye/);
    expect(docs).toMatch(/npm run ui:screenshot/);
    expect(docs).toMatch(/\.artifacts\/screenshots/);
    expect(docs).toMatch(/UI_SCREENSHOT_TOOL_MISSING/);
    expect(docs).toMatch(/npm install --save-dev playwright/);
    expect(gitignore).toMatch(/\.artifacts\//);
  });

  it('adds only dev helper scripts and reports missing Playwright clearly', () => {
    const pkg = JSON.parse(source('package.json')) as { scripts: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const screenshotScript = source('scripts/ui-screenshot.mjs');
    const monitorScript = source('scripts/agent-monitor.mjs');

    expect(pkg.scripts['agent:monitor']).toBe('node scripts/agent-monitor.mjs');
    expect(pkg.scripts['ui:screenshot']).toBe('node scripts/ui-screenshot.mjs');
    expect(pkg.scripts['ui:verify']).toBe('node scripts/ui-screenshot.mjs --verify');
    expect(pkg.dependencies?.playwright).toBeUndefined();
    expect(pkg.dependencies?.cypress).toBeUndefined();
    expect(pkg.devDependencies?.playwright).toBeUndefined();
    expect(pkg.devDependencies?.cypress).toBeUndefined();
    expect(screenshotScript).toMatch(/UI_SCREENSHOT_TOOL_MISSING/);
    expect(screenshotScript).toMatch(/UI_SCREENSHOT_BROWSER_MISSING/);
    expect(screenshotScript).toMatch(/\.artifacts\/screenshots/);
    expect(monitorScript).toMatch(/does not start paid, cloud-only, or production services/);
  });
});

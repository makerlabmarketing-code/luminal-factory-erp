import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function source(path: string) {
  return readFileSync(path, 'utf8');
}

describe('dev-only agent visual monitoring workflow', () => {
  it('points duplicate monitoring guidance to the canonical visual monitoring document', () => {
    const docs = source('docs/agent-visual-monitoring.md');
    const gitignore = source('.gitignore');

    expect(docs).toMatch(/docs\/DEV_VISUAL_MONITORING\.md/);
    expect(docs).toMatch(/npm run ui:screenshot/);
    expect(docs).toMatch(/\.artifacts\/screenshots/);
    expect(docs).toMatch(/UI_SCREENSHOT_BROWSER_MISSING/);
    expect(docs).toMatch(/do not commit auth state/);
    expect(gitignore).toMatch(/\.artifacts\//);
  });

  it('adds only dev helper scripts and no production browser dependency', () => {
    const pkg = JSON.parse(source('package.json')) as { scripts: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const screenshotScript = source('scripts/ui-screenshot.mjs');
    const monitorScript = source('scripts/agent-monitor.mjs');

    expect(pkg.scripts['agent:monitor']).toBe('node scripts/agent-monitor.mjs');
    expect(pkg.scripts['ui:screenshot']).toBe('node scripts/ui-screenshot.mjs');
    expect(pkg.scripts['ui:verify']).toBe('node scripts/ui-screenshot.mjs --verify');
    expect(pkg.scripts['ui:install-browser']).toBe('playwright install chromium');
    expect(pkg.dependencies?.playwright).toBeUndefined();
    expect(pkg.dependencies?.cypress).toBeUndefined();
    expect(pkg.devDependencies?.playwright).toBeDefined();
    expect(screenshotScript).toMatch(/UI_SCREENSHOT_AUTH_REQUIRED/);
    expect(screenshotScript).toMatch(/UI_SCREENSHOT_BROWSER_MISSING/);
    expect(source('scripts/ui-screenshot-config.mjs')).toMatch(/\.artifacts\/screenshots/);
    expect(monitorScript).toMatch(/does not start paid, cloud-only, or production services/);
  });
});

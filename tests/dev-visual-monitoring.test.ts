import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function source(path: string) {
  return readFileSync(path, 'utf8');
}

describe('dev visual monitoring documentation and tooling', () => {
  it('keeps Playwright dev-only and documents approved screenshot workflow', () => {
    const docs = source('docs/DEV_VISUAL_MONITORING.md');
    const pkg = JSON.parse(source('package.json')) as { scripts: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const gitignore = source('.gitignore');

    expect(docs).toMatch(/Playwright is a dev dependency only/);
    expect(docs).toMatch(/npm run ui:install-browser/);
    expect(docs).toMatch(/UI_SCREENSHOT_STORAGE_STATE/);
    expect(docs).toMatch(/no safe checked-in browser auth fixture exists/);
    expect(docs).toMatch(/network allowlist update/);
    expect(docs).toMatch(/UI_SCREENSHOT_BROWSER_MISSING/);
    expect(docs).toMatch(/\.artifacts\/screenshots/);
    expect(pkg.scripts['ui:screenshot']).toBe('node scripts/ui-screenshot.mjs');
    expect(pkg.scripts['ui:verify']).toBe('node scripts/ui-screenshot.mjs --verify');
    expect(pkg.scripts['ui:install-browser']).toBe('playwright install chromium');
    expect(pkg.dependencies?.playwright).toBeUndefined();
    expect(pkg.dependencies?.cypress).toBeUndefined();
    expect(pkg.devDependencies?.playwright).toBeDefined();
    expect(pkg.devDependencies?.cypress).toBeUndefined();
    expect(gitignore).toMatch(/\.artifacts\//);
    expect(gitignore).toMatch(/playwright-report\//);
    expect(gitignore).toMatch(/\.auth\//);
  });

  it('shares route and viewport configuration with the screenshot script', () => {
    const config = source('scripts/ui-screenshot-config.mjs');
    const script = source('scripts/ui-screenshot.mjs');

    expect(config).toMatch(/screenshotRoutes/);
    expect(config).toMatch(/requiresAuth: true/);
    expect(config).toMatch(/admin-projects/);
    expect(config).toMatch(/staff-tasks/);
    expect(config).toMatch(/desktop/);
    expect(config).toMatch(/mobile/);
    expect(script).toMatch(/UI_SCREENSHOT_BASE_URL/);
    expect(script).toMatch(/UI_SCREENSHOT_AUTH_REQUIRED/);
    expect(script).toMatch(/UI_SCREENSHOT_STORAGE_STATE/);
    expect(script).toMatch(/UI_SCREENSHOT_BROWSER_MISSING/);
  });
});

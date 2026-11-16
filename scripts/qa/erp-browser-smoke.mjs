import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const origin = new URL(process.env.QA_BASE_URL || 'https://erp.luminalfactory.com');
if (origin.protocol !== 'https:' || origin.hostname !== 'erp.luminalfactory.com' || origin.username || origin.password) {
  throw new Error('QA_BASE_URL must be https://erp.luminalfactory.com');
}
const storageState = process.env.QA_STORAGE_STATE_PATH;
if (storageState && process.env.GITHUB_ACTIONS === 'true') {
  throw new Error('Authenticated QA is forbidden on public GitHub Actions runners. Use a private local session.');
}
const routes = ['/login', '/admin/capital', '/admin/projects', '/admin/employees', '/admin/payroll', '/staff/tasks'];
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || '.qa-browser-results');
const observations = [];
const problems = [];
const startedAt = new Date().toISOString();
const clip = value => String(value || '').replace(/https?:\/\/\S+/g, '[url]').slice(0, 220);

async function audit(page, route, viewport) {
  const label = viewport.name + ' ' + route;
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(clip(error.message)));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(clip(message.text()));
  });
  let response;
  try {
    response = await page.goto(new URL(route, origin).href, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(350);
    const finalUrl = new URL(page.url());
    if (finalUrl.origin !== origin.origin) throw new Error('Unexpected redirect outside ERP origin');
    if (!response || response.status() >= 500) throw new Error('HTTP document status ' + (response?.status() ?? 'unknown'));
    let body = await page.locator('body').innerText({ timeout: 7000 });
    if (body.trim().length < 12) {
      await page.waitForTimeout(650);
      body = await page.locator('body').innerText({ timeout: 7000 });
    }
    if (body.trim().length < 12) throw new Error('Page body is blank');
    if (/Application error: a client-side exception|Internal Server Error/i.test(body.slice(0, 800))) {
      throw new Error('Visible application exception');
    }
    // A generic 200/visible body is not a security check. All guest ERP routes
    // must show the actual login form or explicitly deny unauthorized access.
    const denied = response.status() === 401 || response.status() === 403;
    const authWall = /\/(login|auth)(\/|$)/.test(finalUrl.pathname) ||
      await page.locator('input[type="password"]').count() > 0;
    if (response.status() === 404) throw new Error('Unexpected 404 for ERP route');
    if (!storageState && (route === '/login' || !denied)) {
      const loginHeading = await page.getByRole('heading', { name: /Đăng nhập ERP/i }).count() > 0;
      const emailField = await page.locator('input[type="email"]').count() > 0;
      const passwordField = await page.locator('input[type="password"]').count() > 0;
      const loginButton = await page.getByRole('button', { name: 'Đăng nhập', exact: true }).count() > 0;
      if (!loginHeading || !emailField || !passwordField || !loginButton) {
        throw new Error(route === '/login'
          ? 'ERP login form is incomplete'
          : 'Guest route rendered without a complete login gate');
      }
    }
    const overflowPx = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
    if (!storageState && !denied && overflowPx > 4) {
      throw new Error('Login form causes horizontal viewport overflow: ' + overflowPx + 'px');
    }
    observations.push({
      viewport: viewport.name, route, status: response.status(), finalPath: finalUrl.pathname,
      mode: denied ? 'access-denied' : authWall ? 'login-gated' : 'rendered',
      overflowPx, consoleErrors: consoleErrors.slice(0, 3),
    });
    if (!authWall && storageState && route === '/admin/capital') await auditLedger(page, label);
    if (pageErrors.length) throw new Error('JavaScript exception: ' + pageErrors.join(' | '));
  } catch (error) {
    problems.push({ viewport: viewport.name, route, message: clip(error.message), step: 'Open and inspect ' + route });
    if (!storageState && process.env.QA_CAPTURE_GUEST_SCREENSHOTS === '1') {
      await page.screenshot({ path: path.join(outputDir, 'guest-' + viewport.name + '-' + route.replaceAll('/', '_') + '.png'), fullPage: true }).catch(() => {});
    }
  }
}

async function auditLedger(page, label) {
  const button = page.getByRole('button', { name: /Thêm Giao Dịch/i }).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });
  }
  const boxes = page.locator('tbody input[type="checkbox"]');
  const count = await boxes.count();
  if (!count) return;
  await boxes.first().check();
  const toolbar = page.getByRole('region', { name: 'Công cụ giao dịch đã chọn' });
  await toolbar.getByText('1 giao dịch đã chọn').waitFor({ state: 'visible', timeout: 5000 });
  if (count > 1) {
    await boxes.nth(1).check();
    await toolbar.getByText('2 giao dịch đã chọn').waitFor({ state: 'visible', timeout: 5000 });
    if (await toolbar.getByRole('button', { name: /Xác nhận đã thu|Xác nhận đã trả|Thử gửi email|Duyệt/i }).count()) {
      throw new Error('Unsafe finance action shown for multiple selected rows at ' + label);
    }
  }
  await toolbar.getByRole('button', { name: 'Bỏ chọn' }).click();
  if (await page.locator('tbody input[type="checkbox"]:checked').count()) throw new Error('Selection not cleared');
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const playwrightPath = path.resolve(process.env.QA_PLAYWRIGHT_MODULE || 'node_modules/playwright/index.mjs');
  let browser;
  try {
    const { chromium } = await import(pathToFileURL(playwrightPath).href);
    browser = await chromium.launch({ headless: true });
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        ...(storageState ? { storageState: path.resolve(storageState) } : {}),
        acceptDownloads: false,
      });
      await context.route('**/*', route => {
        const method = route.request().method();
        const uri = route.request().url();
        if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !uri.includes('/auth/v1/token')) {
          return route.abort('blockedbyclient');
        }
        return route.continue();
      });
      for (const route of routes) {
        const page = await context.newPage();
        await audit(page, route, viewport);
        await page.close();
      }
      await context.close();
    }
  } catch (error) {
    problems.push({ step: 'Browser bootstrap', message: clip(error.message) });
  } finally {
    await browser?.close();
  }
  const report = { startedAt, baseOrigin: origin.origin, mode: storageState ? 'local-authenticated-readonly' : 'public-guest-readonly', checks: observations.length, problems, observations };
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const summary = [
    '## Luminal ERP browser QA',
    '',
    '- Mode: ' + report.mode,
    '- Pages inspected: ' + observations.length,
    '- Failures: ' + problems.length,
    '- IMPORTANT: guest smoke does not certify authenticated tab/menu/table/panel workflows.',
    '',
    ...problems.map(problem => '- FAIL ' + (problem.viewport || '') + ' ' + (problem.route || problem.step) + ': ' + problem.message),
    '',
  ].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  process.stdout.write(summary);
  if (problems.length) process.exitCode = 1;
}

await main();

#!/usr/bin/env node
import { access, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as wait } from 'node:timers/promises';
import {
  defaultBaseUrl,
  defaultOutputDir,
  defaultReadySelector,
  screenshotRoutes,
  screenshotViewports,
} from './ui-screenshot-config.mjs';

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const require = createRequire(import.meta.url);

const shouldStartServer = args.has('--start-server');
const verifyOnly = args.has('--verify');
const includeAuthenticated = args.has('--include-authenticated') || process.env.UI_SCREENSHOT_INCLUDE_AUTHENTICATED === '1';
const baseUrl = process.env.UI_SCREENSHOT_BASE_URL || defaultBaseUrl;
const outputDir = process.env.UI_SCREENSHOT_DIR || defaultOutputDir;
const readySelector = process.env.UI_SCREENSHOT_READY_SELECTOR || defaultReadySelector;
const storageState = process.env.UI_SCREENSHOT_STORAGE_STATE;
const selectedRouteNames = valuesFor('--route');
const selectedViewportNames = valuesFor('--viewport');

function valuesFor(flag) {
  return rawArgs
    .map((arg, index) => (arg === flag ? rawArgs[index + 1] : undefined))
    .filter(Boolean);
}

function printUsage() {
  console.log(`Dev-only UI screenshot workflow\n\nUsage:\n  npm run ui:screenshot\n  npm run ui:screenshot -- --start-server\n  npm run ui:screenshot -- --include-authenticated\n  npm run ui:screenshot -- --route home --viewport mobile\n  npm run ui:verify\n\nEnvironment:\n  UI_SCREENSHOT_BASE_URL=${baseUrl}\n  UI_SCREENSHOT_DIR=${outputDir}\n  UI_SCREENSHOT_READY_SELECTOR=${readySelector}\n  UI_SCREENSHOT_STORAGE_STATE=.auth/storage-state.json\n  UI_SCREENSHOT_INCLUDE_AUTHENTICATED=1\n\nOutput is ignored by git under .artifacts/. Auth storage state must stay local under .auth/.`);
}

async function loadPlaywright() {
  try {
    require.resolve('playwright');
  } catch {
    console.error('UI_SCREENSHOT_TOOL_MISSING: Playwright chưa được cài trong devDependencies.');
    console.error('Run `npm install --save-dev playwright` and `npm run ui:install-browser` after tooling approval.');
    process.exit(2);
  }

  return import('playwright');
}

async function ensureStorageStateIfProvided() {
  if (!storageState) return undefined;
  try {
    await access(storageState);
    return storageState;
  } catch {
    console.error(`UI_SCREENSHOT_AUTH_STATE_MISSING: Không tìm thấy storage state tại ${storageState}.`);
    console.error('Create it locally with the documented manual-auth workflow, or unset UI_SCREENSHOT_STORAGE_STATE.');
    process.exit(5);
  }
}

function selectedRoutes() {
  const routes = selectedRouteNames.length
    ? screenshotRoutes.filter((route) => selectedRouteNames.includes(route.name) || selectedRouteNames.includes(route.path))
    : screenshotRoutes;

  const captureRoutes = routes.filter((route) => !route.requiresAuth || includeAuthenticated || storageState);
  const skippedAuthRoutes = routes.filter((route) => route.requiresAuth && !includeAuthenticated && !storageState);

  if (selectedRouteNames.length && captureRoutes.length === 0) {
    console.error(`UI_SCREENSHOT_ROUTE_UNAVAILABLE: No requested route can be captured: ${selectedRouteNames.join(', ')}`);
    console.error('Authenticated routes require --include-authenticated or UI_SCREENSHOT_STORAGE_STATE.');
    process.exit(6);
  }

  for (const route of skippedAuthRoutes) {
    console.warn(`UI_SCREENSHOT_AUTH_REQUIRED: Skipping ${route.name} (${route.path}); provide UI_SCREENSHOT_STORAGE_STATE or --include-authenticated to use an existing session.`);
  }

  return captureRoutes;
}

function selectedViewports() {
  if (!selectedViewportNames.length) return screenshotViewports;
  const viewports = screenshotViewports.filter((viewport) => selectedViewportNames.includes(viewport.name));
  if (!viewports.length) {
    console.error(`UI_SCREENSHOT_VIEWPORT_UNKNOWN: Unknown viewport(s): ${selectedViewportNames.join(', ')}`);
    console.error(`Supported viewports: ${screenshotViewports.map((viewport) => viewport.name).join(', ')}`);
    process.exit(7);
  }
  return viewports;
}

async function waitForServer(url) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) return;
    } catch {
      // Retry until the local dev server is ready or the deadline is reached.
    }
    await wait(750);
  }

  console.error(`UI_SCREENSHOT_SERVER_UNAVAILABLE: Không có Next.js dev server phản hồi tại ${url}.`);
  console.error('Start it with `npm run dev`, or run `npm run ui:screenshot -- --start-server`.');
  process.exit(3);
}

async function main() {
  if (args.has('--help')) {
    printUsage();
    return;
  }

  const playwright = await loadPlaywright();
  const storageStatePath = await ensureStorageStateIfProvided();
  const routes = selectedRoutes();
  const viewports = selectedViewports();
  let devServer;
  let browser;

  if (shouldStartServer) {
    devServer = spawn('npm', ['run', 'dev'], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
    });
  }

  try {
    await waitForServer(baseUrl);
    await mkdir(outputDir, { recursive: true });

    browser = await playwright.chromium.launch();

    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        storageState: storageStatePath,
      });
      const page = await context.newPage();

      for (const route of routes) {
        const url = new URL(route.path, baseUrl).toString();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
        await page.locator(readySelector).first().waitFor({ state: 'visible', timeout: 15_000 });

        if (!verifyOnly) {
          await page.screenshot({ path: `${outputDir}/${route.name}-${viewport.name}.png`, fullPage: true });
        }
        console.log(`${verifyOnly ? 'Verified' : 'Captured'} ${route.name} ${viewport.name}: ${url}`);
      }

      await context.close();
    }

    if (!verifyOnly) console.log(`Screenshots saved to ${outputDir}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Executable doesn't exist|browserType\.launch|Host system is missing dependencies|Failed to launch/i.test(message)) {
      console.error('UI_SCREENSHOT_BROWSER_MISSING: Playwright đã có, nhưng thiếu Chromium binary hoặc host dependencies.');
      console.error('Run `npm run ui:install-browser` locally. In Codex Cloud this may be blocked by network/domain policy.');
      process.exit(4);
    }
    console.error(`UI_SCREENSHOT_FAILED: ${message}`);
    process.exit(1);
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (devServer) devServer.kill('SIGTERM');
  }
}

main();

#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as wait } from 'node:timers/promises';

const args = new Set(process.argv.slice(2));
const shouldStartServer = args.has('--start-server');
const verifyOnly = args.has('--verify');
const baseUrl = process.env.UI_SCREENSHOT_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.UI_SCREENSHOT_DIR || '.artifacts/screenshots';

const require = createRequire(import.meta.url);

const pages = [
  { name: 'home', path: '/' },
  { name: 'admin-projects', path: '/admin/projects' },
  { name: 'admin-project-detail-1', path: '/admin/projects/1' },
  { name: 'staff-tasks', path: '/staff/tasks' },
];

function printUsage() {
  console.log(`Dev-only UI screenshot workflow\n\nUsage:\n  npm run ui:screenshot\n  npm run ui:screenshot -- --start-server\n  npm run ui:verify\n\nEnvironment:\n  UI_SCREENSHOT_BASE_URL=${baseUrl}\n  UI_SCREENSHOT_DIR=${outputDir}\n\nOutput is ignored by git under .artifacts/.`);
}

async function loadPlaywright() {
  try {
    require.resolve('playwright');
  } catch {
    console.error('UI_SCREENSHOT_TOOL_MISSING: Playwright is not installed in this repository.');
    console.error('This project intentionally does not add heavy browser tooling by default.');
    console.error('To enable local screenshots after approval, install a dev-only Playwright package and browser binaries, then rerun this script.');
    process.exit(2);
  }

  return import('playwright');
}

async function waitForServer(url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) return;
    } catch {
      // Retry until the local dev server is ready or the deadline is reached.
    }
    await wait(750);
  }

  console.error(`UI_SCREENSHOT_SERVER_UNAVAILABLE: No local Next.js server responded at ${url}.`);
  console.error('Start it with `npm run dev`, or run `npm run ui:screenshot -- --start-server`.');
  process.exit(3);
}

async function main() {
  if (args.has('--help')) {
    printUsage();
    return;
  }

  const playwright = await loadPlaywright();
  let devServer;

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

    const browser = await playwright.chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

    for (const target of pages) {
      const url = new URL(target.path, baseUrl).toString();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      if (!verifyOnly) {
        await page.screenshot({ path: `${outputDir}/${target.name}.png`, fullPage: true });
      }
      console.log(`${verifyOnly ? 'Verified' : 'Captured'} ${target.name}: ${url}`);
    }

    await browser.close();
    if (!verifyOnly) console.log(`Screenshots saved to ${outputDir}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Executable doesn't exist|browserType\.launch|Host system is missing dependencies/i.test(message)) {
      console.error('UI_SCREENSHOT_BROWSER_MISSING: Playwright is present, but the Chromium browser binary or host dependencies are missing.');
      console.error('Install browser binaries locally after approval, then rerun this dev-only script.');
      process.exit(4);
    }
    console.error(`UI_SCREENSHOT_FAILED: ${message}`);
    process.exit(1);
  } finally {
    if (devServer) devServer.kill('SIGTERM');
  }
}

main();

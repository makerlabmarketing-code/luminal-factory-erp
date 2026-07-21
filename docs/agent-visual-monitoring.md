# Agent Visual Monitoring and UI Verification

Date: 2026-07-21

## Purpose

This document describes a dev-only workflow for monitoring AI coding sessions and collecting visual evidence for Luminal Factory ERP UI changes.

The workflow does not change production runtime behavior, does not require paid or cloud-only services, and does not add browser automation dependencies to the Next.js runtime bundle.

## Current repository state

Inspection result for this slice:

- `package.json` uses Next.js, Vitest, TypeScript, and npm scripts for `dev`, `test`, `lint`, and `build`.
- The test suite is Vitest-based under `tests/`.
- No Playwright or Cypress runtime dependency is installed in `package.json`.
- `package-lock.json` contains Vitest optional metadata for `@vitest/browser-playwright`, but the package is not available to project scripts.
- No existing screenshot capture workflow was found.
- `.artifacts/` is gitignored for local screenshots and monitoring evidence.

## Agent session monitoring

Use Agent Eye or an equivalent local agent session dashboard as a companion monitor while Codex or another coding agent works.

Recommended local layout:

1. Open the agent session dashboard in a local browser.
2. Keep the repository terminal visible for command output and validation gates.
3. Keep the local ERP app open at `http://127.0.0.1:3000` when UI changes are being made.
4. Record any important visual findings in the PR body or review comments.
5. Attach screenshot files from `.artifacts/screenshots/` to the PR when a UI change is visible.

The helper command prints this checklist without starting production services:

```bash
npm run agent:monitor
```

## Dev-only screenshot workflow

The repository includes a lightweight script wrapper at `scripts/ui-screenshot.mjs` but intentionally does not install Playwright or browser binaries by default.

Run the workflow after a UI change when browser tooling is available locally:

```bash
npm run dev
npm run ui:screenshot
```

Or let the script start a local dev server:

```bash
npm run ui:screenshot -- --start-server
```

By default, screenshots are saved to:

```text
.artifacts/screenshots/
```

The folder is ignored by git and is intended for PR attachments, manual review, and temporary local evidence only.

## Verification-only mode

To verify that key routes can be loaded without writing screenshots:

```bash
npm run ui:verify
```

This uses the same route list as screenshot capture but skips image files.

## Configurable environment variables

```bash
UI_SCREENSHOT_BASE_URL=http://127.0.0.1:3000
UI_SCREENSHOT_DIR=.artifacts/screenshots
```

Use `UI_SCREENSHOT_BASE_URL` when the dev server runs on another port.

## Current route list

The dev-only workflow currently targets these key pages:

- `/`
- `/admin/projects`
- `/admin/projects/1`
- `/staff/tasks`

Authenticated routes may render login, no-workspace, or permission states depending on local session and Supabase configuration. That is acceptable for visual evidence as long as the PR describes the session state used.

## Missing browser tooling behavior

If Playwright is not installed, the script exits clearly with:

```text
UI_SCREENSHOT_TOOL_MISSING
```

If Playwright is installed but Chromium or host browser dependencies are missing, the script exits clearly with:

```text
UI_SCREENSHOT_BROWSER_MISSING
```

These failures should not block normal build validation unless the active task explicitly requires screenshot evidence and the operator has approved installing browser tooling.

## Minimal setup proposal when approved

Because this repository does not currently include Playwright/Cypress, do not add heavy dependencies automatically. If the team approves local browser tooling, the minimal dev-only setup is:

```bash
npm install --save-dev playwright
npx playwright install chromium
```

Then run:

```bash
npm run ui:screenshot -- --start-server
```

Do not add Playwright to production dependencies. Do not require a paid dashboard. Do not use live data mutations only to make screenshots look complete.

## PR evidence checklist

For visible UI changes, include in the PR:

- the command used to capture screenshots;
- the local base URL;
- which session state was used, such as logged out, admin session, staff session, or permission-denied state;
- the screenshot filenames from `.artifacts/screenshots/`;
- any environment limitation, such as missing browser binaries.

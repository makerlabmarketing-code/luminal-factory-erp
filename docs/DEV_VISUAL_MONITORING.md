# Dev Visual Monitoring and UI Verification

Date: 2026-07-21

## Scope

This is the repository-wide dev-only workflow for observing AI coding sessions and collecting visual evidence for Luminal Factory ERP UI changes.

This workflow preserves production runtime behavior:

- no production code path is changed;
- Playwright is a dev dependency only;
- no Playwright browser binary, token, cookie, or auth state is committed;
- no database schema, RLS, role permission, feature flag, RPC, backfill, deployment, or live data mutation is required.

## Installation

Install normal repository dependencies with npm:

```bash
npm install
```

Playwright must remain in `devDependencies`. Do not add Playwright, Cypress, browser launchers, credentials, cookies, or Supabase secrets to production dependencies or runtime code.

## Browser setup

Install the minimum approved browser binary for screenshots:

```bash
npm run ui:install-browser
```

This runs `playwright install chromium`. If the download is blocked by Codex Cloud or a corporate network, keep the dev-only setup and capture screenshots locally instead.

## Screenshot commands

Use an already running local server:

```bash
npm run dev
npm run ui:screenshot
```

Or let the workflow start the dev server:

```bash
npm run ui:screenshot -- --start-server
```

Verification-only mode loads the same routes without writing images:

```bash
npm run ui:verify
```

Useful options and environment variables:

```bash
UI_SCREENSHOT_BASE_URL=http://127.0.0.1:3000 npm run ui:screenshot
UI_SCREENSHOT_DIR=.artifacts/screenshots npm run ui:screenshot
UI_SCREENSHOT_READY_SELECTOR=body npm run ui:screenshot
npm run ui:screenshot -- --route home --viewport mobile
npm run ui:screenshot -- --include-authenticated
```

Screenshots are saved under `.artifacts/screenshots/` and are ignored by git.

## Approved screenshot routes

The route list lives in `scripts/ui-screenshot-config.mjs` so tests and the screenshot script share one source of truth.

Default public routes:

- `/`
- `/auth/no-workspace`

Approved authenticated ERP routes:

- `/admin/projects`
- `/admin/projects/1`
- `/staff/tasks`

Authenticated routes are skipped by default unless the operator explicitly supplies an auth workflow. The script exits non-zero when a requested route or required screenshot cannot be captured.

## Authenticated-page setup

Inspection result: no safe checked-in browser auth fixture exists for this repository.

Until an approved fixture exists, use one of these local-only workflows:

1. Manual authenticated state file:
   - Start the app locally.
   - Sign in through the normal ERP login flow with a safe local account.
   - Save Playwright storage state outside git, preferably under `.auth/storage-state.json`.
   - Run:

     ```bash
     UI_SCREENSHOT_STORAGE_STATE=.auth/storage-state.json npm run ui:screenshot -- --include-authenticated
     ```

2. Environment-provided storage state:
   - Provide `UI_SCREENSHOT_STORAGE_STATE` from a secure local or CI secret mount.
   - Keep the file outside committed source control.
   - Document the session state in the PR evidence checklist.

Never hardcode credentials, cookies, tokens, Supabase keys, or session data. Never bypass authentication or mutate live data only to make a screenshot state.

## PR evidence workflow

For UI PRs, include:

- whether screenshots were captured in Codex Cloud or locally;
- the command used;
- the base URL;
- the page paths and viewport names captured;
- the session state, such as logged out, admin session, staff session, or permission denied;
- the screenshot filenames from `.artifacts/screenshots/`;
- any limitation such as missing browser package, blocked Chromium download, missing auth fixture, or unavailable local data.

## Codex Cloud limitations

Codex Cloud may block browser binary downloads or browser execution. In this task, browser setup failed when Chromium download returned `403 Domain forbidden` from the Playwright CDN.

When that happens:

- normal validation must still use `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`;
- screenshot capture remains a local evidence step;
- report the exact blocker;
- do not make normal repository validation depend on Playwright browser binaries.

## Agent session monitoring

Use the Codex task log as the primary monitoring surface in Codex Cloud. A local dashboard such as Agent Eye or `coding-by-feng/ai-agent-session-center` can be operator-owned local tooling, but it is not a repository dependency and must not be required for normal validation.

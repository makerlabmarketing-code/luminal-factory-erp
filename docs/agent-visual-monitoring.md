# Agent Visual Monitoring and UI Verification

Date: 2026-07-21

`docs/DEV_VISUAL_MONITORING.md` is the repository source of truth for dev-only screenshot and visual evidence workflows.

Use this file only as a short operator pointer:

- run `npm run agent:monitor` for the local monitoring checklist;
- run `npm run ui:install-browser` to install the approved Chromium browser locally;
- run `npm run ui:screenshot` to capture files under `.artifacts/screenshots/`;
- expect `UI_SCREENSHOT_BROWSER_MISSING` or a browser-download blocker in Codex Cloud when Chromium cannot be installed;
- do not commit auth state, screenshots, videos, traces, tokens, cookies, or Supabase secrets.

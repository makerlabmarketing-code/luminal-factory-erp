# QA-002: project creation keyboard flow

The create-project form now opens as a named modal in a body portal, focuses the
project name, wraps Tab/Shift+Tab, handles Escape and returns to its trigger.
Controls are disabled while saving; the existing loading layer is a live status,
not a second unnamed dialog. No API, data, role, template or release gate changes.

Changing the project preset opens the existing global confirmation. Both that
confirmation and the create dialog use a focus scope stack: the foremost scope
owns focus and Escape, then restores the underlying select. Toasts retain their
existing top layer. Other project action dialogs are outside this bounded slice.

Validation: 1,013 tests / 144 files, lint and TypeScript pass. Three executable
focus-controller regressions cover initial focus, wrapping, hidden/disabled
controls, focus escape, nested confirmations, restoration and cleanup. The old
static Escape assertion follows the extracted handler rather than requiring
inline event handling. Local build needs public placeholder Supabase config
because a fresh worktree has no environment file; no secret is read or changed.
Hosted review is not available; source, tests and current PR threads are the
available review sources. Production keyboard smoke remains a post-deploy check.

Rollback: revert the app/UI/helper/test diff together. No database rollback or
live-record cleanup is needed. This does not resolve QA-003 rollout gates or
replace create/save/reload, staff and two-session acceptance for E-011.

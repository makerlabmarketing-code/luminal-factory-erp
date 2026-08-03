# Shared ERP authentication routing contract

## Entry and return-path rules

`/login` is the shared credential entry for both workspaces. An unauthenticated
request for `/staff` or any nested Staff route is redirected there with the
original local path in `next`. Only local `/staff`, `/admin`, and the small
allowlist of Auth application paths are accepted; scheme-relative and absolute
URLs are rejected.

After Supabase verifies the session, the server reloads the linked active
Employee and resolves `ADMIN_WORKSPACE` and `STAFF_WORKSPACE`. Route names never
grant permission. A Staff-only account may return to its requested Staff path; an
Admin-only account may return to its requested Admin path. A cross-workspace
request falls back to that account's authorized workspace. The existing
dual-workspace default remains Admin, where the approved workspace switch is
available.

An already authenticated visitor to `/login` passes through the same server
workspace resolver. Invalid or expired sessions return to the shared login
without exposing tokens or raw callback errors. Password-update completion uses
the same workspace endpoint, so Staff-only accounts do not pass through an Admin
page after setting a password.

## Staff session exit

The Staff profile is the visible session-management surface on desktop and
mobile. `Đăng xuất` uses the shared Supabase local-scope sign-out helper, locks
before the asynchronous request, and replaces browser history with `/login` only
after Supabase confirms success. A failure keeps the Staff view in place and
shows controlled Vietnamese copy with a client-generated support ID; tokens,
cookies, and raw provider errors are never rendered or logged.

The application does not clear unrelated browser preferences. Middleware
continues to verify the Supabase user for every `/staff` navigation, so a logged
out or expired session cannot restore protected Staff content through browser
Back or direct navigation. Login after logout follows the same server-owned
workspace rules above; logout never chooses an Admin destination.

## Production origin and callback safety

`NEXT_PUBLIC_APP_BASE_URL` owns the public origin and must be
`https://erp.luminalfactory.com` in production. Password emails return through
`/auth/callback`; callback tokens are exchanged into cookies and removed from the
visible URL before navigation. Preview origins are not embedded in application
code.

## Rollback

Revert the shared login page, workspace redirect route, middleware redirect,
workspace return-path helper, and Staff profile logout component together. This
changes no Auth identity, Employee, workspace permission, RLS policy, database
row, or Supabase configuration.

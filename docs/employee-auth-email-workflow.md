# Employee Auth email workflow

## Application boundary

All Employee Auth administration is owned by authenticated server routes. The
browser submits only a stable Employee ID; the server reloads the Employee,
normalizes the stored email, requires `ADMIN_WORKSPACE` plus `ACCOUNT_MANAGE`, and
uses the server-only Supabase Admin client.

| Admin action | Route | Auth operation | Result |
|---|---|---|---|
| Gửi lời mời | `POST /api/admin/employees/:id/invite` | `auth.admin.inviteUserByEmail` | Creates/invites only when no exact Auth identity exists. An existing identity is a conflict, not an implicit link. |
| Kết nối tài khoản hiện có | `POST /api/admin/employees/:id/connect-account` | Admin Auth lookup plus conditional Employee update | Links one exact normalized-email match only when it is not linked to another Employee. Creates no Auth user and grants no workspace or permission. |
| Gửi lại lời mời | `POST /api/admin/employees/:id/resend-invite` | Linked-identity verification | The installed Supabase Auth client supports resend for signup/email-change, not Admin invite. The route returns a controlled unsupported result and sends nothing rather than misusing signup or password recovery. |
| Gửi link đặt lại mật khẩu | `POST /api/admin/employees/:id/send-password-reset` | `auth.resetPasswordForEmail` | Requires a linked Employee and redirects through `/auth/callback` to `/auth/update-password?mode=recovery`. |
| Quên mật khẩu | `/auth/forgot-password` | normal Supabase client `resetPasswordForEmail` | Enumeration-safe public recovery response and the same recovery callback. |

Successful email responses mean **Supabase Auth accepted the request**. They do
not prove provider handoff or inbox receipt. Responses therefore carry a safe
`code`, `deliveryState`, `accountState`, `message`, and `correlationId`, and the UI
states that delivery remains unknown.

## Production diagnosis

The earlier UI could report “Đã gửi” after an Auth call returned without an error,
which overstated the observable result. It also used `inviteUserByEmail` for a
resend even though the linked Auth identity already existed, and its initial
invite action silently linked an existing Auth identity instead of distinguishing
the operator's intent. The corrected contract separates invite, connect, resend,
and reset operations and preserves the provider error boundary.

Repository inspection proves the request routes, permission checks, Auth API,
and production redirect construction. Codex Cloud cannot prove the production
Supabase Site URL, redirect allowlist, SMTP/provider configuration, quota, spam
classification, delivery delay, or inbox receipt without performing a prohibited
live Auth mutation. Operators should correlate a controlled manual action with
the returned correlation ID and Supabase Auth logs, then verify:

1. `https://erp.luminalfactory.com/auth/callback` is permitted by Auth redirect configuration.
2. the configured Site URL is the production ERP origin;
3. SMTP/provider health and quota, including Supabase default-provider restrictions;
4. Auth email rate-limit events and provider acceptance/rejection;
5. spam/quarantine and recipient delivery only after provider acceptance.

An uncertain response must not be retried automatically. The UI uses a synchronous
client lock to prevent double clicks; the operator chooses whether and when to
retry after inspecting the correlation result.

# ERP transactional email delivery

ERP business notifications use a server-only SMTP provider. This boundary is separate from Supabase Auth: Supabase Auth continues to own invitations, verification, password recovery, and other authentication messages. ERP templates must never fall back to Auth email delivery.

## Required Vercel/server variables

- `EMAIL_DELIVERY_ENABLED` — required runtime gate; absent/anything other than `true` means disabled (the safe default).
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS` — secret; never expose with a `NEXT_PUBLIC_` prefix.
- `SMTP_FROM_EMAIL` — sender address on the verified provider domain; required when SMTP_USER is not an email (Resend uses `resend`).
- `SMTP_FROM_NAME` — optional display name; defaults to `Luminal ERP`.

When the gate is enabled but provider values are absent, Admin receives **Chưa cấu hình dịch vụ gửi email** plus the missing server variable names. The application does not crash and does not expose values.

## Admin test-send contract

1. Open **Mẫu Email**, select one template, and choose **Gửi email thử nghiệm**.
2. Review the subject/body preview and explicitly enter one recipient.
3. The server validates all `{{placeholder}}` and legacy `[placeholder]` tokens. An unresolved token blocks delivery.
4. Only an Admin with `EMPLOYEE_MANAGE` can send. The UI and server prevent duplicate submission.
5. The response contains a sanitized correlation ID, outcome, and rendered subject only—never provider credentials or raw provider errors.
6. Success/failure is recorded in `email_history`; logging uses a classified failure code.

This slice does not authorize bulk sends, automatic production delivery, enabling the runtime gate, configuring secrets, or using Supabase Auth as a business mail provider.

## Operator production test checklist

- Keep `EMAIL_DELIVERY_ENABLED=false` while configuring Vercel server-only SMTP values.
- Verify all variables exist in the intended Vercel environment and none use `NEXT_PUBLIC_`.
- With the flag still false, confirm test send returns the controlled disabled message.
- Enable only in an approved production change window; send one template to an explicitly controlled operator address.
- Confirm one delivery/history row, correlation ID, rendered subject/body, and provider receipt.
- Test one template with a missing placeholder and confirm no provider request/history success occurs.
- Confirm a Staff/non-authorized account receives denial.
- Confirm rapid double-click results in only one provider request.
- Re-disable immediately if provider authentication, network, rejection, or history recording validation fails.

## Salary payment notification

E-010 uses the individual salary expense's **Đã trả** action, never payroll settlement alone. `SALARY_PAYMENT_EMAIL_ENABLED` defaults off; SQL, template, provider and controlled smoke prerequisites are documented in `supabase/drafts/salary-payment-email/README.md`. SMTP acceptance and inbox delivery are different outcomes. A history write failure must not lead to a duplicate resend. Current history insert uses only the seven deployed columns; classified SMTP errors stay in sanitized application logs.

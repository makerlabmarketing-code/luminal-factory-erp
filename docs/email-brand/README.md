# Luminal transactional email design

Updated the five functional ERP templates (IDs 7–11) on 2026-10-13 under the user’s request to align email with the website. No schema or email-trigger changes.

Design: existing gold/resin logo, dark canvas, warm gold double rim, restrained cyan label, white primary text, readable detail rows and a destination-specific CTA. The outer/inner rim uses the same #8b6d41/#58462c tokens as ERP. Email clients get solid borders rather than the website’s CSS gradient, hover, animation or backdrop effects.

Salary retains Vietnamese; raffle retains English and the existing payment/allocation rules. Existing subjects, plain-text database body, IDs and placeholder sets are unchanged. WELCOME ID 6 remains untouched because its current content is test data (`123`).

Run `python scripts/build-email-brand.py` to regenerate HTML and a sample preview. These are authoring assets, not an automatic deployment or database migration. Updating production templates still needs an authorized bounded template operation; compare the current value before replacing it.

`previous-templates.json` records the pre-change values for rollback. Restore only the corresponding `html_content` after checking that no newer template edit has occurred. No payroll or customer records need reverting.

Validation: five exact placeholder sets match previous templates; all layout tables have presentation semantics; one heading per email; absolute 200 OK PNG logo URL with explicit dimensions; inline styles and no scripts/forms/stylesheets; each email under 6 KiB. Salary was inspected in ERP and sent via the existing test action to the previously authorized recipient. Client-specific Outlook/Gmail dark-mode rendering has not been independently verified.

`public/brand/email-preview.html` is a public sample using fictitious employee/payment data, not a real salary receipt.

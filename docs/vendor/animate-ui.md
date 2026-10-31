# Animate UI integration · 2026-11-01

Scope: Project creation checklist stages and per-task assignment/deadline overrides.

Source: https://github.com/imskyleen/animate-ui at `dec9850cf8684250d4c289af3e4b3865707ce986`,
`apps/v1/packages/ui/src/components/animate-ui/collapsible.tsx`.
License: see `animate-ui-LICENSE.md` in this directory.

The local AnimatedDisclosure adapts CollapsibleContent's Motion height/opacity
transition. A native button with stable aria-controls/expanded replaces Radix.
Panels remain mounted to retain nested form state; closed panels are inert and
hidden from assistive technology immediately. Opening lasts 180ms, closing
120ms; reduced motion uses zero duration. No continuous animation is added.

This is a source integration, not installation of the latest npm package.
Animate UI 2.4.1 requires Motion 14; this slice uses Motion 12 and does not
upgrade the existing Next.js, React, Tailwind or Base UI dependencies.

Validation: repository test, lint, type and build gates; visual/keyboard smoke
is recorded separately in the coordination sheet. No database, workflow,
authorization, feature flag, email or payment behavior changes.
Rollback: revert this slice's application files and dependency/lockfile addition.

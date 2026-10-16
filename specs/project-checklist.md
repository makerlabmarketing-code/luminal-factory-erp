# Project checklist implementation specification

Approval: the user requested minimal entry, reusable project dropdown templates,
a save-as-template checkbox and simple staff operations, approved the proposed
flow, then requested roadmap implementation on 2026-10-16.

Acceptance: stage-based creation with inherited people/deadlines and optional
per-task exceptions; published immutable template selection; optional snapshot
of structure only; explicit progress/review statuses; no mandatory routine note;
blocked reason required; no staff self-approval; authenticated server writes;
atomic task/comment updates and stale-status rejection; no old-data conversion.

Implementation, validation, remaining template limitations and the separate SQL
approval boundary are recorded in docs/project-checklist-handoff.md. Production
activation and authenticated smoke remain pending, so this slice is not live.

# ERP and Commerce QA — 2026-10-19, first bounded pass

## Scope and evidence

Read-only source review and live desktop browser QA of authenticated ERP project list → create modal → checklist editor → cancel → existing project detail, and Commerce VI Home → Shop → Meowhe Lolipop → EN language switch → EN/VI Raffle. No source, live records, database, flags, permissions, orders, payments, raffle entries, mail or notifications were changed by this QA agent.

ERP source inspected at `9c8bed6da22e24b4e32bba8cd5c9e770e8df6a3a`, with the root agent's in-progress #233 repair artifacts left untouched. Root independently confirmed #233 merged as `32f847c`, Production READY deployment `dpl_5BFryQ3E891rD9Wyn53AntP4riyT`; SQL repair validated and no QA fixture remained. This known PROJECT_CREATED repair is excluded from new findings. Commerce source: `413145fd0e850b86af35261e6e8ff34a6f4c5922`.

## Verified findings

### QA-001 — P2: raffle-only keycap advertised as direct sale

- Surface: `https://luminalfactory.com/vi/shop`, Meowhe Lolipop card.
- Expected: artisan keycap release presentation agrees with the approved raffle-only rule, regardless of a legacy catalog release type.
- Actual: card displays **BÁN TRỰC TIẾP · ARTISAN KEYCAP**, $70, while its detail says there is currently no release. The card separately states that purchasing is not yet open, so this is misleading classification rather than a confirmed transaction bypass.
- Evidence: live browser accessibility tree; `luminal-factory-commerce/src/features/shop/catalog-adapter.ts:193-205` derives release label solely from `release_type`, without a `product_type` guard; `src/features/shop/shop-collection.tsx` renders that label. `specs/catalog/catalog-onboarding-specification.md:67` explicitly states artisan_keycap is raffle-only. Guest cart rejection remains present at `src/lib/supabase/guest-cart-server.ts:110`; cart boundary tests passed.
- Reproduce: open VI Shop; read the Meowhe card; open its detail and inspect release section.
- Scope/uncertainty: confirmed on this published keycap. No cart or purchase mutation was attempted; current stored catalog value was inferred from rendered output and mapper, not queried directly. Repair should reconcile catalog validation/presentation under the existing rule, preserving cart rejection.

### QA-002 — P2: create-project overlay leaves keyboard focus on the underlying page

- Surface: `https://erp.luminalfactory.com/admin/projects`, create-project modal.
- Expected: opening the modal moves focus inside it; keyboard focus remains inside while it is open, with an accessible dialog name and close action.
- Actual: immediately after clicking **Tạo dự án**, focus remains on the triggering background button; pressing Tab moves focus to the background project search field while the modal is still open. The overlay is an unnamed container, and its X close button has no accessible name.
- Evidence: live browser accessibility tree explicitly reports focused element `Tạo dự án` after opening, then the underlying list search text field after Tab. Source `app/admin/projects/page.tsx:780-791` uses ordinary divs without dialog semantics/focus management and an icon-only X button without aria-label.
- Reproduce: load project list; activate Tạo dự án; press Tab once; observe focus on the background search. Cancel the form without saving.
- Scope/uncertainty: desktop keyboard behavior verified; screen-reader speech and mobile keyboard behavior not tested. This is a functional accessibility issue, not a request to redesign approved visual styling.

## Verified rollout blocker — not an authorization defect

Existing project `https://erp.luminalfactory.com/admin/projects/12` is viewable with its phases and membership, but displays **Nền tảng giao việc chưa sẵn sàng**; task creation is disabled, history/comments await activation, phase transitions are compatibility/read-only. Consequently the newly created checklist's complete manager/staff workflow cannot yet be accepted as delivered end-to-end.

Root independently checked Production configuration read-only: the following flags are absent, while checklist-create and phase-template flags are enabled:

- `TASK_ASSIGNMENT_FOUNDATION_ENABLED`: `services/server/taskAssignmentFoundation.ts:66-75`; absence causes foundation migration gate.
- `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED`: same file, task create capability and mutation gate.
- `TASK_COMMENTS_ACTIVITY_ENABLED`: `services/server/projectActivity.ts:22`.
- `PHASE_WORKFLOW_FOUNDATION_ENABLED` and `PHASE_STATUS_MUTATION_ENABLED`: `services/server/phaseMutations.ts:122-135`.

UI task fetch handling: `app/admin/projects/[projectId]/page.tsx:400-409` maps any failed task response to the blocked state; phase capability derives from phase_status_mutation_available at line 640. The verified state is **rollout incomplete / acceptance blocked**. Do not enable flags without checking migration/readiness and the approved rollout scope.

## Validation completed

- Commerce `npm ci --ignore-scripts --no-audit --no-fund`, followed by `npm test`: **382 passed, 0 failed**. An earlier test attempt before dependencies were installed failed on missing packages; that was environment setup, and the subsequent complete run passed.
- ERP focused `npm test -- tests/project-checklist.test.ts tests/task-status-transitions.test.ts tests/project-template-snapshot.test.ts`: **9 tests, 2 matched files passed**. The absent named filter must not be counted as a third tested file.
- Live ERP form loaded the artisan checklist with 15 stages, per-stage assignment/deadline controls, per-task exceptions and save-as-template checkbox after options loaded. Existing project list/detail navigation and membership display worked.
- Commerce product detail, colorway selector presentation, language switch preserving product route, and EN/VI raffle unavailable-state recovery links rendered. Product detail showed no purchase action.

## Untested gaps and candidates

- No responsive viewport control was used; only desktop was actually observed. Mobile/tablet, reduced motion, slow loading, WebGL capability and scroll reversal need a separate browser pass. Home showed a 3D fallback in this cloud browser; this alone is not a production 3D defect.
- No live project/template save, staff mutation, manager review, stale-write rejection, permission-negative account test, cart mutation or raffle entry was attempted. Root's separate transaction-rollback RPC smoke is a different evidence source.
- requires_review=false still maps staff completion to PENDING_REVIEW in staff action/RPC code. This is a **business-rule clarification candidate**, not a confirmed defect: first resolve whether every task needs review or the per-stage checkbox is meant to bypass review.
- VI product description currently falls back to English; catalog translation code explicitly permits English fallback. Missing approved VI content is not asserted as a rendering bug.
- Raffle routes show an unavailable-state message in both languages; no backend failure cause was proven. Do not conflate unpublished/disabled rollout with an outage.
- No full ERP test suite, lint/typecheck/build, production browser console sweep, or comprehensive security audit was performed by this bounded QA pass.

## Next QA acceptance slice

Resolve QA-001 and QA-002; establish readiness/approved activation for task/phase foundation; then test disposable staging project → template save → template reuse → employee start/block/resume/submit → manager revision/approval → completion, including cancellation, reload and stale changes. Follow with explicit desktop/tablet/mobile Commerce navigation, filters, media, errors and non-keycap/cart boundary checks.

# ERP Domain

This file owns durable Luminal ERP business rules for staff, attendance, payroll, production workflow, colorways, materials, expenses, finance, and future commerce administration.

## Staff

A staff or employee record represents a person operating within Luminal Factory.

Use stable employee identifiers for persisted relationships. Display names are presentation values, not authoritative relationship keys.

Relevant concerns may include active status, branch or work location, role, assigned work, attendance, and payroll.

## Attendance

Attendance records represent operational time evidence.

Relevant events include check-in and check-out.

Attendance logic may need to handle missing check-out, duplicate check-in, duplicate check-out, day boundaries, timezone behavior, location validation, and manual correction.

Worked hours should derive from authoritative timestamps and approved adjustment rules.

## Payroll

Payroll derives from approved payroll rules and authoritative operational inputs.

Potential inputs include attendance, worked hours, hourly rate, fixed salary rules, and approved adjustments.

Authoritative payroll totals should be calculated from approved source inputs outside transient UI state.

Preserve enough source data to reproduce totals.

## Production Project

A production project represents operational work toward a product, release, collection, or production objective.

A project may contain one or more colorways or variants. Project-level status and colorway-level progress are separate concerns.

Production work should be traceable by project, colorway or variant, workflow stage, workflow status, assigned staff, timestamps, and review or approval when required.

Project status should be derived from stage, task, approval, production, sales, and fulfillment state whenever possible.

Manual project-status override requires permission, confirmation, reason, note, and audit log.

## Colorway

A colorway is a visual or production variant.

Production tracking may need to be assigned and reviewed per colorway.

A colorway may share product identity while having separate color planning, tests, media, production progress, and approval state.

## Project and Colorway Workflow

Each project or colorway workflow should support stages, tasks, assignments, reviewers, dependencies, checklists, attachments, comments, deadlines, blocking reasons, revisions, approvals, reopening, status history, and audit history when those concepts apply to the product.

Recommended project stages:

1. Concept and Direction
2. 3D Design
3. Print File Preparation
4. Print Test and Inspection
5. Colorway Development
6. Mold Making
7. Test Casting
8. Product Finishing
9. Content and Media
10. Launch Preparation
11. Sales and Production
12. Fulfillment and After-sales

Not every stage applies to every product. The workflow system should support controlled variation without losing traceability.

## Workflow Definition

A workflow definition describes operational stages.

Current workflow configuration may be loaded from system settings associated with `PRODUCTION_WORKFLOW`.

Workflow definitions may evolve. Historical project records must remain interpretable after workflow changes.

## Workflow Stage

A workflow stage is a named operational step.

Examples from Luminal production may include concept, sculpt, 2D or card preparation, color planning, support and slicing, test print, parameter tuning, mold making, resin casting, sanding, painting, packaging, photography, video, content, shipping, and after-sales.

The final stage list is configurable and product-dependent.

## Workflow Status

This file is the canonical source for workflow status vocabulary.

A workflow status is a domain state, not only a display label. Code, enum, type, API, and database values may use English identifiers. User-facing labels must use the Vietnamese mappings below through the shared vocabulary source defined in `references/ui-rules.md`.

Use this canonical task-status set unless an approved specification changes it:

- Backlog -> Chưa xếp lịch
- Ready -> Sẵn sàng
- InProgress -> Đang làm
- PendingReview -> Chờ duyệt
- RevisionRequired -> Cần sửa
- Approved -> Đã duyệt
- Blocked -> Bị vướng
- OnHold -> Tạm dừng
- Completed -> Hoàn thành
- Cancelled -> Đã hủy

Recommended project-status vocabulary:

- Draft -> Bản nháp
- Planning -> Đang lên kế hoạch
- InProgress -> Đang thực hiện
- PendingReview -> Chờ duyệt
- Blocked -> Bị vướng
- OnHold -> Tạm dừng
- ReadyForProduction -> Sẵn sàng sản xuất
- InProduction -> Đang sản xuất
- ReadyForLaunch -> Sẵn sàng mở bán
- Selling -> Đang mở bán
- Fulfillment -> Đang xử lý đơn
- Completed -> Hoàn thành
- Cancelled -> Đã hủy
- Archived -> Đã lưu trữ

Changing canonical statuses, status meaning, or state-machine behavior requires an approved specification before schema changes or production-code changes.

When the same status appears in more than one module, use the same Vietnamese label unless an approved specification documents a user-facing reason to differ.

## Stage Status Labels

Stage-specific status labels should avoid overly technical wording. Use short, common Vietnamese terms that staff can understand quickly.

Recommended stage-label mappings:

- DevelopingConcept -> Đang lên ý tưởng
- PendingConceptReview -> Chờ duyệt ý tưởng
- Sculpting -> Đang dựng mẫu 3D
- PreparingModel -> Đang chuẩn bị file
- PlacingSupports -> Đang đặt support
- Slicing -> Đang cắt file in
- Printing -> Đang in thử
- Inspecting -> Đang kiểm tra
- MixingColor -> Đang pha màu
- TestingColor -> Đang thử màu
- PouringSilicone -> Đang đổ khuôn
- Curing -> Đang chờ khô
- Demolding -> Đang tháo khuôn
- Casting -> Đang đổ resin
- Sanding -> Đang chà nhám
- DetailPainting -> Đang sơn chi tiết
- QualityChecking -> Đang kiểm tra chất lượng
- Photographing -> Đang chụp ảnh
- RecordingVideo -> Đang quay video
- PostProduction -> Đang chỉnh sửa nội dung
- PreparingPackaging -> Đang chuẩn bị đóng gói
- Packing -> Đang đóng gói
- InTransit -> Đang vận chuyển
- Delivered -> Đã giao hàng

## State Transitions

Valid task-transition examples:

- Backlog -> Ready
- Ready -> InProgress
- InProgress -> PendingReview
- PendingReview -> Approved
- PendingReview -> RevisionRequired
- RevisionRequired -> InProgress
- InProgress -> Blocked
- Blocked -> InProgress
- InProgress -> OnHold
- OnHold -> Ready
- Approved -> Completed

Invalid by default:

- Backlog -> Completed
- Backlog -> Approved
- Ready -> Approved
- Ready -> Completed
- Completed -> InProgress
- Cancelled -> InProgress

Admin override requires explicit permission, reason, note, confirmation, and an audit entry.

Each transition should record entity type, entity ID, old status, new status, changed by, changed at, reason, note, attachment when relevant, next assignee when relevant, and override flag.

## Assignment

Workflow tasks may be assigned to staff members using stable identifiers.

Assignment history may matter for accountability and production traceability.

## Approval and Review

A completed action and an approved result are not always the same state. Preserve this distinction where the actual production process needs it.

Supported review actions:

- SubmitForReview
- Approve
- RequestRevision
- Reject
- CancelReview
- Reopen

The task creator or assignee should not approve their own task unless a specific permission allows it.

Store reviewer, submitter, submitted time, reviewed time, decision, comments, attachments, revision reason, and version.

Review status labels:

- NotSubmitted -> Chưa gửi duyệt
- Submitted -> Đã gửi duyệt
- PendingReview -> Chờ duyệt
- Approved -> Đã duyệt
- RevisionRequested -> Cần sửa
- Rejected -> Đã từ chối

## Materials and Inventory

Operational inventory may distinguish raw materials, consumables, and finished product stock.

Examples include printing resin, casting resin, silicone, packaging materials, and finishing consumables.

The ERP should preserve source quantities and inventory movements when authoritative stock is required.

## Expenses

Expenses are source records.

An expense may include category, amount, date, description, employee or submitter, project relation, and approval state.

Derived totals should come from source records.

## Finance

Financial reporting should derive from authoritative operational and commerce source records.

Financial totals should derive from expenses, payments, refunds, and other authoritative source records rather than independent copies that can drift.

## Future Commerce Administration

The ERP is expected to become the operational back office for products, product variants, product media, collections, raffles, raffle lifecycle, winner operations, commissions, customers, orders, payments, refunds, shipments, and finished product inventory.

Shared commerce contracts must remain compatible with the storefront.

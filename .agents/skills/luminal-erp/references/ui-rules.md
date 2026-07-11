# UI and UX Rules

This file owns durable ERP UI direction, application shell expectations, page patterns, responsive behavior, accessibility, and advisory UI-reference boundaries.

## Experience Direction

The ERP is an operational tool.

The interface should feel clear, efficient, calm, structured, state-aware, compact, dense but readable, consistent, and production-ready.

It may share restrained Luminal brand tokens while remaining optimized for internal operations rather than cinematic storefront presentation.

Tiếng Việt là ngôn ngữ mặc định và duy nhất trên giao diện Luminal Factory ERP, trừ tên thương hiệu, tên riêng, mã sản phẩm, mã kỹ thuật và dữ liệu do người dùng nhập.

UI priority:

1. data clarity
2. operational state clarity
3. action clarity
4. scanning speed
5. responsive usability
6. visual polish

Prefer subtle borders, limited shadows, moderate border radius, clear typography hierarchy, compact KPI cards, useful tables, decision-support charts, clear status badges, activity feeds, consistent spacing, and semantic status colors.

Avoid landing-page layouts, portfolio styling, glassmorphism, decorative gradients, oversized typography, excessive animation, giant cards, excessive whitespace, random icon colors, deeply nested cards, and duplicated page headers.

## Vietnamese Interface Language

All user-visible content must be Vietnamese:

- statuses
- labels
- buttons
- titles
- notifications
- menus
- table headers
- chart labels
- form labels
- tooltips
- placeholders
- validation messages
- empty states
- confirmation messages

Use short, clear, common words. Prefer familiar verbs. Avoid technical English when a simple Vietnamese word works. Do not mix English and Vietnamese in the same screen.

Do not write labels in all caps. Avoid long sentences. Do not use multiple words for the same idea.

Preferred wording:

- use `Tạo`, `Tạo mới`, or `Lưu`; avoid heavier wording when the action is simple
- use `Thực hiện` instead of `Thực thi`
- use `Duyệt` instead of `Phê duyệt`
- use `Tạo` instead of `Khởi tạo`
- use `Bị vướng` for blocked operational work
- use `Cần sửa` for revision-required work

Code identifiers may stay English. Variables, enums, types, API names, and database values may use English when that keeps implementation stable. Every enum or status shown in the UI must have a Vietnamese label mapping.

## Shared Vocabulary Source

Create and use one shared vocabulary source for the whole ERP before broad UI refactors. Acceptable target paths include:

- `lib/i18n/vi.ts`
- `lib/constants/labels.ts`
- `lib/constants/status-labels.ts`

Prefer a structure that separates:

- status labels
- action labels
- menu labels
- validation messages
- notification messages
- empty-state messages
- confirmation messages

Do not hard-code Vietnamese labels such as `Đang làm`, `Chờ duyệt`, or `Hoàn thành` in multiple components.

Every status badge must read its label from the shared source. Every table, filter, chart, form, tooltip, placeholder, validation message, notification, and empty state should use the shared source when the text is reusable.

When the same status appears across modules, use the same Vietnamese label. Domain status mappings live in `references/erp-domain.md`.

## Standard Action Labels

Use these labels for common actions:

- Create -> Tạo mới
- Edit -> Chỉnh sửa
- Delete -> Xóa
- Archive -> Lưu trữ
- Save -> Lưu
- SaveDraft -> Lưu nháp
- Cancel -> Hủy
- Confirm -> Xác nhận
- Approve -> Duyệt
- Reject -> Từ chối
- RequestRevision -> Yêu cầu sửa
- Reopen -> Mở lại
- Assign -> Giao việc
- Upload -> Tải tệp lên
- Download -> Tải xuống
- Search -> Tìm kiếm
- Filter -> Bộ lọc
- Sort -> Sắp xếp
- ViewDetails -> Xem chi tiết

Prefer the shortest label that still makes the action clear in context.

## Standard Alert Labels

Use these labels for common operational alerts:

- Overdue -> Quá hạn
- DueSoon -> Sắp đến hạn
- MissingAssignee -> Chưa có người làm
- MissingDeadline -> Chưa có hạn hoàn thành
- PendingTooLong -> Chờ quá lâu
- LowStock -> Sắp hết hàng
- Failed -> Không đạt
- NeedsAttention -> Cần xử lý

## Empty States

Empty states should be simple and specific.

Examples:

- Chưa có dự án nào
- Chưa có công việc được giao
- Không tìm thấy kết quả
- Chưa có dữ liệu để hiển thị

Filtered empty states should say that no result matched the current filters, not that no records exist.

## Validation Messages

Validation messages should explain the problem in plain Vietnamese and point to the next action.

Examples:

- Vui lòng nhập tên dự án
- Vui lòng chọn người phụ trách
- Ngày hoàn thành phải sau ngày bắt đầu
- Công việc này đang bị vướng
- Bạn không có quyền thực hiện thao tác này

## Confirmation Messages

Confirmation messages should state the consequence clearly.

Examples:

- Bạn có chắc muốn xóa công việc này không?
- Dự án sẽ được chuyển vào mục lưu trữ.
- Thao tác này không thể hoàn tác.
- Bạn có chắc muốn mở lại công việc đã hoàn thành không?

## Application Shell

The ERP should have one consistent application shell.

Required shared structure:

- `AppSidebar`
- `AppHeader`
- `MainContent`
- breadcrumbs
- page title
- global search
- command menu
- quick-create action
- notification center
- theme switcher
- user menu
- responsive mobile navigation
- permission-aware navigation

Suggested navigation groups:

- Overview: Dashboard, My Work, Notifications
- Workspace: Projects, Workflow, Calendar, Files
- Operations: Production, Print Tests, Mold Management, Casting Batches, Quality Control, Inventory, Assets
- Commerce: Products, Colorways, Raffles, Orders, Fulfillment, Customers
- Team: Staff, Attendance, Payroll, Workload
- Finance: Expenses, Revenue, Budget, Reports
- Administration: Users, Roles, Permissions, Workflow Templates, System Settings, Audit Log

Only show modules the current user can access. Hiding UI controls is not a security boundary; backend and database policies must still enforce permissions.

## Shared Page Patterns

Dashboard pages should include a page header, context or date filters, KPI grid, main chart when it supports a decision, secondary metrics, attention-required section, recent activity, recent records table, and quick actions.

List pages should include breadcrumb, title, description, primary action, search, filters, sorting, view switcher when useful, table or card grid, pagination, bulk actions, loading state, empty state, filtered empty state, and error state.

Detail pages should include breadcrumb, entity title, status, metadata, primary actions, tabs, related records, attachments, activity history, and sticky action area when useful.

Create and edit pages should include page header, form sections, validation messages, server error handling, unsaved-change protection, save draft when useful, save, cancel, and loading state.

Settings pages should include settings navigation, section title, description, form, save state, and reset or cancel when appropriate.

Report pages should include filter toolbar, KPI summary, chart when it supports a decision, table, export, loading state, empty result, and error state.

## Component Ownership

UI components such as Button, Badge, Card, Dialog, Dropdown, Input, Select, Checkbox, Table, Tabs, Tooltip, Sheet, Skeleton, Popover, Command, and Form must not contain ERP domain logic.

Shared application components include patterns such as `AppSidebar`, `AppHeader`, `AppBreadcrumb`, `PageHeader`, `DataTable`, `DataTableToolbar`, `FilterBar`, `SearchInput`, `ViewSwitcher`, `EmptyState`, `ErrorState`, `LoadingState`, `MetricCard`, `ChartCard`, `ActivityFeed`, `EntityStatusBadge`, `DeadlineIndicator`, `AssigneeCell`, `PermissionGuard`, `ConfirmActionDialog`, `UnsavedChangesGuard`, `FileUploader`, `NotificationPopover`, and `GlobalCommandMenu`.

Domain components include patterns such as `ProjectStatusBadge`, `TaskStatusBadge`, `StageStatusBadge`, `WorkflowStageCard`, `WorkflowTimeline`, `TaskKanbanBoard`, `ProjectProgressBar`, `ProjectMemberSelector`, `ApprovalDialog`, `RevisionRequestDialog`, `BlockingReasonDialog`, `CastingBatchTable`, `MoldStatusCard`, `QualityControlResult`, and `InventoryStockIndicator`.

Do not duplicate components only because they are used by different pages.

## Status Presentation

Production statuses must be distinguishable without relying only on color.

Use labels, icons where useful, position or grouping, and color as reinforcement.

Status treatments should expose semantic hierarchy instead of presenting many visually similar pills.

## Workflow Views

Colorway-oriented project views should make it easy to answer:

- what stage this colorway is in
- what is ready
- what is blocked
- who owns the current work
- what needs review
- what needs revision
- what is completed

The primary workflow view should show current production state at scan level before item drill-down.

## Tables

Use tables for dense comparable records.

Support appropriate sorting, filtering, pagination or virtualization, empty states, loading states, and error states.

Keep primary actions discoverable.

Put row actions where they support the primary task; move secondary or rare actions into a lower-emphasis control.

## Forms

Use explicit labels.

Show validation near the relevant field.

Protect destructive or high-impact operations with appropriate confirmation.

Preserve user input after a failed submission.

## Staff Portal

Staff Portal screens should be fast on mobile.

Prioritize the current task.

Attendance actions should be immediately understandable.

Task views should emphasize assignment, current state, and next required action.

Staff Portal density should match task execution on mobile rather than admin review.

## Dashboard

Dashboards should answer operational questions.

Charts and summary cards require a real decision use case.

Use real Luminal ERP data. Do not keep Efferd demo metrics unless they map to a real ERP module.

Suggested KPI cards:

- Active Projects
- Tasks Due Today
- Pending Approvals
- Blocked Tasks
- Production In Progress
- QC Failure Rate
- Low Stock Items
- Orders Awaiting Fulfillment

Suggested sections:

- Project Progress
- Production Health
- Team Workload
- Attention Required
- Recent Activity
- Recent Projects
- My Work

## Responsive and Accessibility Requirements

Support large desktop, desktop, laptop, tablet, and basic mobile workflows.

Requirements:

- sidebar becomes a drawer on mobile
- tables support horizontal scrolling when needed
- Kanban supports horizontal scrolling when needed
- filters may move into a Sheet
- important actions remain accessible
- keyboard navigation works
- focus states are visible
- icon-only buttons have labels or tooltips
- forms expose validation correctly
- status does not rely on color alone
- dialogs manage focus correctly
- semantic elements are preferred over clickable `div` elements
- readable contrast is preserved
- reduced motion is supported for non-essential transitions

## Data States

Every data-driven page should handle initial loading, background refresh, empty state, filtered empty state, error state, permission denied, and partial widget failure when appropriate.

Do not use a full-screen spinner when only one dashboard widget is loading.

Use layout-matching skeletons.

## Shadcn, Efferd, and Icons

Shadcn UI, Radix UI, Lucide Icons, and the visual structure of Efferd Dashboard 2 are references for the ERP design system.

Efferd Dashboard 2 is a layout and visual-density reference. Do not copy demo financial data, fake revenue metrics, example invoices, unrelated SaaS content, placeholder charts, or placeholder activity feeds.

Translate reference layouts into real Luminal Factory ERP data and workflow needs.

Use Lucide icons where they fit the existing repository guidance. Do not introduce a second icon system only because an advisory skill recommends it.

## UI UX Pro Max

Use `.codex/skills/ui-ux-pro-max/SKILL.md` only as advisory design intelligence under the authority order in `AGENTS.md`.

Apply only checklist items that fit a Next.js web ERP.

Ignore React Native-only assumptions, mobile-app-only safe-area rules, and any requirement that conflicts with this repository's stack or existing design system.

Do not treat Phosphor icons as mandatory. Prefer Lucide, Shadcn UI, Radix UI, and Efferd-inspired structure according to repository guidance.

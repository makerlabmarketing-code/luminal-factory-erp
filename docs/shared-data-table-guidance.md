# Shared data-table infrastructure and first-wave inventory

## Boundary

The shared layer is presentation and list-state infrastructure only. Pages continue to own API requests, business filters, row rendering, mutations, permissions, copy, and row actions. Generic table components must not import ERP services or make authorization decisions.

Use `DataTableShell` to keep a controlled minimum viewport and responsive horizontal overflow. Use `DataTableSkeleton` only for an initial table request, and retain current rows with the shell's `isRefreshing` indicator during later requests. `DataTableError`, `DataTableEmpty`, and `DataTablePagination` provide consistent accessible table-region states. `useDataTableState` resets to page 1 only when its meaningful `queryKey` changes and clamps the page after deletion.

Use local row patching when a successful mutation response contains the authoritative record. Use a targeted refetch when the response cannot authoritatively represent derived rows, totals, or an independent audit source. A route refresh or browser reload is prohibited when its only purpose is synchronizing a list.

## Migration matrix

| Page | Loading before this slice | Mutation refresh | Query controls | Recommended primitive | Priority | Risk / status |
| --- | --- | --- | --- | --- | --- | --- |
| Staff Attendance | Entire attendance view replaced during GET; month changes collapsed the card | Mutation already patched current aggregate; conflict recovery could silently GET | Month + local 5-row pagination | Compact shell, skeleton, error, pagination | P0 | Medium; migrated |
| Admin Attendance | Entire page replaced on initial and every GET | Modal mutation triggered full month GET | Employee + month; selected date modal | Viewport shell and local record patch | P0 | High; migrated |
| Employees | Server seed plus `useAdminListData`; duplicated bespoke toolbar/table | Targeted list refresh after mutations | Search, status, facility, pagination | Standard shell, toolbar, pagination, shared state | P1 | Medium; deferred to PR B |
| Admin Projects | Entire page replaced by loading return | Project create re-runs page list request | Search/status/client pagination | Tall shell, toolbar, pagination | P1 | High; deferred to PR B |
| Staff Tasks | Entire task view replaced during request | Status update reloads list data | Status grouping; no shared pagination | Standard shell and local row patch | P1 | High; deferred to PR B |
| Admin Tasks | Server-rendered project/task aggregation | No generic mutation refresh path | Project grouping | Standard shell after API boundary review | P2 | High; deferred |
| Finance ledger | Ledger-local skeleton exists; table UI is bespoke | Server-owned mutations reload finance payload | Type/date/search filters | Tall shell after finance row-model review | P2 | High; explicitly deferred; no finance logic changed |

## Request and state behavior

Staff check-in/check-out remains one mutation request on success: the returned aggregate record updates the current card and history locally, with no follow-up GET. Staff history month changes make one scoped GET and preserve the rest of the attendance card while the table region refreshes.

Admin create/update/cancellation now patches only the returned record in the selected month state. It no longer performs the duplicate GET previously triggered by `onReload`; the daily modal and selected date remain mounted. Month or employee filter changes still make one scoped GET and keep the shell visible. Audit events remain independent and are refreshed on the next targeted month/filter request rather than coupling the mutation to recovery.

## Usage example

Compose a toolbar and table content inside `DataTableShell`. Supply `label`, a controlled height variant, and `isRefreshing`. Render a skeleton only if there are no prior rows, otherwise leave rows visible. Pages supply table headers, rows, fetchers, filters, business empty copy, permissions, and actions. Do not add business-specific props to the shared component; create a domain component beside the owning page instead.

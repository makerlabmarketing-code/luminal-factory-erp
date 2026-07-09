# Coding Style

## General

Preserve existing behavior during refactoring.

Use explicit domain language.

## TypeScript

Use strict TypeScript.

Do not introduce new `any`.

When touching an existing `any`, replace it when the actual shape can be established safely within the task.

Prefer explicit domain types, discriminated unions for stateful workflows, readonly values where mutation is unnecessary, and shared reusable types for repeated domain structures.

Avoid unsafe assertions used only to silence the compiler.

## Naming

Prefer:

    employeeId
    attendanceRecord
    workflowStage
    workflowStatus
    assignedEmployeeId
    workedHours
    payrollPeriod
    expenseCategory

Avoid generic names such as `data`, `item`, `obj`, `temp`, and `info2` when a real domain name exists.

Boolean names should communicate conditions.

Examples:

    isCheckedIn
    canCheckOut
    isWorkflowBlocked
    hasPendingReview

## Stable Identifiers

`references/erp-domain.md` owns stable relationship rules.

Use its identifier rules when naming variables, parameters, and types.

## React

Keep components focused.

Separate data access, domain calculation, interaction, and presentation.

A component should not simultaneously own a complex Supabase query, payroll calculations, workflow rules, and large markup.

## Services

Service functions should use explicit inputs and typed outputs.

Prefer:

    getEmployeeAttendance(employeeId, range)
    calculatePayroll(input)
    transitionWorkflowStage(input)

Avoid vague names such as `processData`, `handleEverything`, and `updateStuff`.

## Supabase Queries

Select only required columns where practical.

Distinguish expected empty results, authorization failures, and database failures.

`references/supabase-contract.md` owns Supabase query-boundary rules.

## Error Handling

User-facing errors must not expose stack traces, secrets, privileged identifiers, or raw database internals.

Operational errors should retain enough context for diagnosis.

## Calculations

Keep time, salary, and financial calculations in pure functions where practical.

Pure calculation seams are preferred regression-test targets.

Document rounding rules when money or worked hours are involved.

## Refactoring

Keep unrelated bug fixes inside the smallest file and responsibility boundary that preserves behavior.

A refactor should expose a clearer responsibility boundary or reduce verified duplication.

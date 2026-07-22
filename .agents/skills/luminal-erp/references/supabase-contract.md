# Supabase Contract

This file owns Supabase client strategy, environment variables, RLS, authorization, query boundaries, database planning, migration preflight, and shared backend strategy.

## Current Concern

The repository has historically used more than one Supabase client pattern.

Known paths have included concepts similar to:

    lib/supabase.ts
    utils or ultis/supabase/client.ts
    utils or ultis/supabase/server.ts
    utils or ultis/supabase/middleware.ts

Inspect the exact current files before editing.

## Client Strategy

The target is one documented purpose-specific strategy.

### Browser client

Use for authenticated browser interactions, client-side realtime behavior, and browser-only workflows.

### Server client

Use for Server Components, server data loading, and server-side authorization-aware operations.

### Middleware or auth client

Use only for middleware or session-refresh responsibilities.

### Privileged server client

Use only when an approved operation genuinely requires privileged access.

Keep privileged credentials server-only.

## Environment Variables

Standardize environment variable naming.

The repository has previously mixed:

    NEXT_PUBLIC_SUPABASE_ANON_KEY

and:

    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

Retain both names only when there is an explicit compatibility reason.

Choose the final environment contract after inspecting installed Supabase versions and deployment configuration.

## Query Boundary

Prefer typed services or data functions.

Examples:

    getEmployeeById
    getAttendanceRange
    getProductionWorkflow
    updateWorkflowAssignment
    getExpenseSummary

## RLS and Authorization

UI visibility is not authorization.

Admin, staff, finance, and customer-related data should use appropriate RLS or trusted server boundaries.

Review privileged mutations for authenticated identity, allowed role, row ownership or operational permission, and audit requirements.

## Database Types

Generated Supabase database types may be introduced after the schema and generation workflow are reviewed.

Database types do not replace domain-state validation, form validation, or workflow-transition rules.

## Stable Relationships

`references/erp-domain.md` owns stable relationship rules.

Use foreign keys and stable identifiers when implementing Supabase relationships.

Do not store related entity IDs as delimited strings.

## Workflow Settings

Current workflow behavior may read from settings associated with:

    system_settings
    group_name
    PRODUCTION_WORKFLOW

Before changing this mechanism:

1. inspect the stored structure
2. inspect every reader
3. inspect every writer
4. inspect historical project records
5. define migration or compatibility behavior

## Database Planning and Migration Preflight

Before creating any migration, report:

- current schema
- proposed schema
- new tables
- changed columns
- foreign keys
- indexes
- unique constraints
- policies or RLS changes
- backfill plan
- compatibility plan
- rollback plan
- data-loss risks

Potential production-workflow entities may include:

- Project
- ProjectStage
- ProjectTask
- ProjectMember
- ProjectTaskAssignee
- ProjectTaskDependency
- ProjectApproval
- ProjectActivityLog
- ProjectAttachment
- ProjectComment
- ProjectChecklist
- ProjectChecklistItem
- ProjectColorway
- ProjectPrintTest
- ProjectMold
- ProjectCastingBatch
- ProjectQcResult
- WorkflowTemplate
- WorkflowTemplateStage
- WorkflowTemplateTask
- WorkflowTransitionRule

No production migration should run without explicit approval.

## Management API Fallback

When Supabase Management API verification returns Cloudflare Error 1010 (`browser_signature_banned`), HTTP 403 from `api.supabase.com` with that confirmed infrastructure restriction, or another confirmed infrastructure restriction unrelated to repository correctness, record `MANAGEMENT_API_UNAVAILABLE`. This is an environment limitation, not evidence of an invalid token, invalid project reference, or repository failure.

Skip only project metadata verification and Management API health verification. Continue application-only implementation and planning from the reviewed repository artifacts: migration package, rollback package, validation SQL, compatibility/backfill plan, application contract, and reviewed RPC contract.

Do not run live SQL, deploy RPCs, mutate RLS, backfill data, or bypass `LIVE_APPROVAL_REQUIRED` because Management API verification is unavailable. Do not ignore validation failures from repository tests, static analysis, SQL validation artifacts, application contracts, or any path unrelated to the Management API limitation. Document the skipped verification in the roadmap, handoff, and remediation ledger.

## Shared Storefront Contract

ERP and storefront may eventually use the same Supabase project.

Public data access and ERP administration remain separate permission concerns.

Potential internal-only fields include staff notes, costs, production notes, workflow audit metadata, supplier data, and finance metadata.

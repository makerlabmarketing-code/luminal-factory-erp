# Supabase Contract

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

## Shared Storefront Contract

ERP and storefront may eventually use the same Supabase project.

Public data access and ERP administration remain separate permission concerns.

Potential internal-only fields include staff notes, costs, production notes, workflow audit metadata, supplier data, and finance metadata.

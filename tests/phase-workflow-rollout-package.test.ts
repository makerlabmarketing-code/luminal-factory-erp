import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const source = (path: string) => readFileSync(join(root, path), 'utf8');

describe('phase workflow rollout package', () => {
  it('keeps one authoritative forward package with atomic service-role-only transition persistence', () => {
    const draft = source('supabase/drafts/20260721_phase_status_dependency_forward.sql');
    const forward = source('supabase/migrations/20260727044729_phase_status_dependency.sql');

    expect(forward).toMatch(/create or replace function public\.transition_project_phase_status/);
    expect(forward).toMatch(/for update/);
    expect(forward).toMatch(/update public\.phases[\s\S]*insert into public\.phase_status_history/);
    expect(forward).toMatch(/security definer/);
    expect(forward).toMatch(/set search_path = public, pg_temp/);
    expect(forward).toMatch(/revoke all on function public\.transition_project_phase_status[\s\S]*from public, anon, authenticated/);
    expect(forward).toMatch(/grant execute on function public\.transition_project_phase_status[\s\S]*to service_role/);
    expect(forward).not.toMatch(/grant execute[^\n]*to (anon|authenticated)/);
    expect(forward.replace(/^--[^\n]*\n--[^\n]*\n/, '')).toBe(
      draft.replace(/^--[^\n]*\n--[^\n]*\n/, '')
    );
  });

  it('documents deterministic backfill, exact commands, rollback loss and all rollout gates', () => {
    const approval = source('docs/phase-workflow-rollout-approval-package.md');

    expect(approval).toMatch(/Exact production changes/);
    expect(approval).toMatch(/Expected row counts/);
    expect(approval).toMatch(/SUPABASE_PRODUCTION_DATABASE_URL/);
    expect(approval).toMatch(/PROMOTED_PENDING_PROTECTED_MAIN_MERGE/);
    expect(approval).toMatch(/Numeric pre-run row counts \| BLOCKED/);
    expect(approval).toMatch(/create_project_atomic\(jsonb\).*excluded from re-promotion/s);
    expect(approval).toMatch(/permanently deletes all transition audit rows/);
  });

  it('requires post-run validation before either runtime capability is activated', () => {
    const checklist = source('docs/phase-workflow-post-rollout-activation-checklist.md');

    expect(checklist).toMatch(/PHASE_WORKFLOW_FOUNDATION_ENABLED=true[\s\S]*only after validation PASS/);
    expect(checklist).toMatch(/PHASE_STATUS_MUTATION_ENABLED=true[\s\S]*only after the status RPC smoke test passes/);
    expect(checklist).toMatch(/Staff Portal attendance loads and performs no project\/member\/phase request/);
  });
});

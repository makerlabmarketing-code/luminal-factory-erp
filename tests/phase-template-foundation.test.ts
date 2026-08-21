import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_PRESETS, ALL_PERMISSION_CODES } from '../lib/account-permissions';

const root = process.cwd();
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('phase template release-one foundation', () => {
  it('keeps the capability server-owned and default disabled', () => {
    const service = source('services/server/phaseTemplates.ts');
    const projects = source('services/server/projectMutations.ts');

    expect(service).toMatch(/process\.env\.PHASE_TEMPLATES_ENABLED === 'true'/);
    expect(service).not.toContain('NEXT_PUBLIC_PHASE_TEMPLATES_ENABLED');
    expect(service).toMatch(/if \(!phaseTemplatesEnabled\(\)\) return \[\]/);
    expect(projects).toMatch(/templateVersionId !== null && \(!phaseTemplatesEnabled\(\) \|\| !projectWorkflowCreationAvailable\(\)\)/);
    expect(projects).toMatch(/Không thể dùng đồng thời mẫu giai đoạn và dữ liệu quy trình tùy chỉnh/);
  });

  it('uses a dedicated management permission without broadening project-manager preset', () => {
    expect(ALL_PERMISSION_CODES).toContain('PHASE_TEMPLATE_MANAGE');
    expect(ACCOUNT_PRESETS.find((preset) => preset.code === 'ADMINISTRATOR')?.permissions)
      .toContain('PHASE_TEMPLATE_MANAGE');
    expect(ACCOUNT_PRESETS.find((preset) => preset.code === 'PROJECT_MANAGER')?.permissions)
      .not.toContain('PHASE_TEMPLATE_MANAGE');
  });

  it('keeps the SQL package empty-seeded, RLS protected, immutable, and atomically promoted', () => {
    const forward = source('supabase/drafts/20260821_phase_template_forward.sql');
    const migration = source('supabase/migrations/20260821065313_phase_template_release_one.sql');
    const rollback = source('supabase/rollbacks/20260821_phase_template_rollback.sql');
    const validation = source('supabase/validation/20260821_phase_template_validation.sql');

    expect(forward).toMatch(/REVIEW ONLY/);
    expect(migration.match(/^begin;$/gm)).toHaveLength(1);
    expect(migration.match(/^commit;$/gm)).toHaveLength(1);
    expect(migration).toMatch(/f893db4f9c021120ea697badda853cb9/);
    expect(migration).toMatch(/manage_phase_template_atomic/);
    expect(migration.match(/insert into public\.phase_templates\s*\(/gi)).toHaveLength(1);
    expect(forward).toMatch(/PHASE_TEMPLATE_MANAGE/);
    expect(forward.match(/enable row level security/g)).toHaveLength(6);
    expect(forward).toMatch(/revoke all on table[\s\S]*from public, anon, authenticated/i);
    expect(forward).toMatch(/grant select on table[\s\S]*to authenticated/i);
    expect(forward).not.toMatch(/grant (insert|update|delete|all).*authenticated/i);
    expect(forward).not.toMatch(/insert into public\.phase_templates\s*\(/i);
    expect(forward).toMatch(/phase_template_applications_immutable/);
    expect(forward).toMatch(/phase_template_audit_immutable/);
    expect(forward).toMatch(/phase_template_stages_draft_only/);
    expect(forward).toMatch(/phase_template_tasks_draft_only/);
    expect(rollback).toMatch(/preserves schema[\s\S]*provenance[\s\S]*audit history/i);
    expect(rollback).not.toMatch(/drop table|delete from public\.phase_template/i);
    expect(validation).toMatch(/no browser writes/i);
    expect(validation).toMatch(/empty initial catalog/i);
    expect(validation).toMatch(/function security/i);
    expect(validation).toMatch(/atomic template contract/i);
    expect(validation).toMatch(/lifecycle integrity/i);
  });

  it('retains the exact atomic-apply stop condition', () => {
    const review = source('docs/phase-template-security-review.md');
    expect(review).toMatch(/PRODUCTION_MIGRATION_PROMOTED_AWAITING_PROTECTED_MAIN/);
    expect(review).toMatch(/No second browser-executable apply RPC is allowed/);
    expect(review).toMatch(/zero project, phase, task, provenance, or audit/);
  });

  it('prepares the approved start-date and exact live atomic replacement contract', () => {
    const forward = source('supabase/drafts/20260821_phase_template_forward.sql');
    const replacement = source('supabase/drafts/20260821_phase_template_create_project_atomic_replacement.sql');
    const server = source('services/server/projectMutations.ts');
    const page = source('app/admin/projects/page.tsx');

    expect(forward).toMatch(/alter table public\.projects add column start_date date null/);
    expect(forward).toMatch(/alter table public\.tasks add column is_required boolean null/);
    expect(forward).toMatch(/alter table public\.tasks add column requires_review boolean null/);
    expect(replacement).toContain('f893db4f9c021120ea697badda853cb9');
    expect(replacement).toMatch(/templateVersionId/);
    expect(replacement).toMatch(/template_start_date_required/);
    expect(replacement).toMatch(/template_custom_workflow_conflict/);
    expect(replacement).toMatch(/template_version_not_current/);
    expect(replacement).toMatch(/template_deadline_overflow/);
    expect(replacement).toMatch(/v_template_stage\.order_index - 1/);
    expect(replacement).toMatch(/phase_template_applications/);
    expect(replacement).toMatch(/phase_template_audit/);
    expect(replacement).toMatch(/assigneeResolved/);
    expect(replacement).toMatch(/revoke all on function[\s\S]*from public, anon/i);
    expect(replacement).toMatch(/grant execute on function[\s\S]*to authenticated, service_role/i);
    expect(server).toMatch(/Vui lòng chọn ngày bắt đầu khi dùng mẫu giai đoạn/);
    expect(page).toMatch(/id="project-start-date"/);
    expect(page).toMatch(/startDate: templateVersionId \? projectStartDate : undefined/);
  });

  it('keeps management mutations behind the same server flag and dedicated permission', () => {
    const service = source('services/server/phaseTemplates.ts');
    const route = source('app/api/admin/phase-templates/route.ts');
    const management = source('supabase/drafts/20260821_phase_template_management_atomic.sql');

    expect(service).toMatch(/mutatePhaseTemplate/);
    expect(service).toMatch(/if \(!phaseTemplatesEnabled\(\)\)/);
    expect(service).toMatch(/hasPermission\(authContext, 'PHASE_TEMPLATE_MANAGE'\)/);
    expect(service).toMatch(/manage_phase_template_atomic/);
    expect(route).toMatch(/mutatePhaseTemplate/);
    expect(management).toMatch(/auth\.uid\(\)/);
    expect(management).toMatch(/has_workspace_access\('ADMIN_WORKSPACE'\)/);
    expect(management).toMatch(/has_permission\('PHASE_TEMPLATE_MANAGE'\)/);
    expect(management).toMatch(/CREATE_DRAFT[\s\S]*UPDATE_DRAFT[\s\S]*CLONE_VERSION[\s\S]*PUBLISH[\s\S]*ARCHIVE[\s\S]*RESTORE[\s\S]*DELETE_DRAFT/);
    expect(management).toMatch(/revoke all on function public\.manage_phase_template_atomic\(jsonb\) from public, anon/);
    expect(management).toMatch(/grant execute on function public\.manage_phase_template_atomic\(jsonb\) to authenticated, service_role/);
  });

  it('fails closed on SQL NULL and packages the complete rollback-only non-production matrix', () => {
    const replacement = source('supabase/drafts/20260821_phase_template_create_project_atomic_replacement.sql');
    const management = source('supabase/drafts/20260821_phase_template_management_atomic.sql');
    const fixture = source('supabase/validation/20260821_phase_template_nonproduction_fixture.sql');
    const runbook = source('docs/phase-template-nonproduction-fixture-runbook.md');

    expect(replacement).toMatch(/p_payload is null or jsonb_typeof\(p_payload\) <> 'object'/);
    expect(management).toMatch(/p_payload is null or jsonb_typeof\(p_payload\) <> 'object'/);
    expect(fixture).toMatch(/NON-PRODUCTION ONLY/);
    expect(fixture).toMatch(/<CONFIRMED_NON_PRODUCTION_ENVIRONMENT>/);
    expect(fixture).toMatch(/<AUTHORIZED_AUTH_UUID>/);
    expect(fixture).toMatch(/<DENIED_AUTH_UUID>/);
    expect(fixture).toMatch(/<MANAGER_EMPLOYEE_ID>/);
    expect(fixture).toMatch(/request\.jwt\.claim\.sub/);
    expect(fixture).toMatch(/template_version_not_current/);
    expect(fixture).toMatch(/template_deadline_overflow/);
    expect(fixture).toMatch(/template_custom_workflow_conflict/);
    expect(fixture).toMatch(/phase_template_fixture_forced_failure/);
    expect(fixture).toMatch(/left partial data/i);
    expect(fixture.trimEnd()).toMatch(/rollback;$/);
    expect(runbook).toMatch(/PACKAGE_READY \/ NOT_EXECUTED/);
    expect(runbook).toMatch(/Do\s+not create a paid Supabase branch/);
    expect(runbook).toMatch(/PHASE_TEMPLATE_NONPRODUCTION_FIXTURE_PASS/);
  });
});

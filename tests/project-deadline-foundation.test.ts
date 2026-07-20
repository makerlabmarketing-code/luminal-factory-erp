import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('project deadline application contract', () => {
  it('accepts projectDeadline in create/update payloads and rejects unknown fields', () => {
    const service = source('services/server/projectMutations.ts');

    expect(service).toMatch(/const CREATE_PROJECT_KEYS = new Set\(\[[\s\S]*'projectDeadline'/);
    expect(service).toMatch(/const UPDATE_PROJECT_KEYS = new Set\(\[[\s\S]*'projectDeadline'/);
    expect(service).toMatch(/function assertKnownFields/);
    expect(service).toMatch(/rejected_field_count/);
    expect(service).not.toMatch(/'targetDate'/);
  });

  it('validates projectDeadline as YYYY-MM-DD and maps it to project_deadline', () => {
    const service = source('services/server/projectMutations.ts');
    const repository = source('services/repositories/workflowRepository.ts');

    expect(service).toMatch(/function isIsoDateOnly/);
    expect(service).toMatch(/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$/);
    expect(service).toMatch(/optionalIsoDate\(body\.projectDeadline, 'projectDeadline'\)/);
    expect(service).toMatch(/project_deadline: params\.projectDeadline/);
    expect(repository).toMatch(/projectDeadline: params\.projectDeadline/);
  });

  it('updates and clears project_deadline through the server boundary', () => {
    const service = source('services/server/projectMutations.ts');
    const repository = source('services/repositories/workflowRepository.ts');
    const route = source('app/api/admin/projects/[projectId]/route.ts');

    expect(route).toMatch(/updateProject\(params\.projectId, body\)/);
    expect(service).toMatch(/Object\.prototype\.hasOwnProperty\.call\(body, 'projectDeadline'\)/);
    expect(service).toMatch(/payload\.project_deadline = projectDeadline/);
    expect(service).toMatch(/project\.status === 'ARCHIVED' \|\| project\.status === 'CANCELLED'/);
    expect(repository).not.toMatch(/from\('projects'\)\.update/);
  });

  it('maps project_deadline into list/detail workflow DTOs without phase or task deadline substitution', () => {
    const workflowService = source('services/workflowService.ts');
    const repository = source('services/repositories/workflowRepository.ts');
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');
    const listPage = source('app/admin/projects/page.tsx');

    expect(repository).toMatch(/project_deadline: pickFirstText\(row, \['project_deadline', 'deadline', 'due_date'\]\) \|\| null/);
    expect(workflowService).toMatch(/project_deadline: project\.project_deadline \|\| ''/);
    expect(workflowService).toMatch(/target_release_date: project\.project_deadline \|\| ''/);
    expect(detailPage).toMatch(/formatDate\(firstDescription\.project_deadline\)/);
    expect(listPage).toMatch(/firstDescription\.target_release_date \|\| firstDescription\.project_deadline/);
  });

  it('allows duplicate project names and never hard-deletes cancelled projects', () => {
    const service = source('services/server/projectMutations.ts');

    expect(service).toMatch(/Duplicate project names are allowed; stable project IDs remain the project identity/);
    expect(service).not.toMatch(/DUPLICATE_BLOCKING_PROJECT_STATUSES/);
    expect(service).not.toMatch(/project_already_exists/);
    expect(service).toMatch(/status: 'CANCELLED'/);
    expect(service).not.toMatch(/from\('projects'\)\.delete|\.delete\(\)\.eq\('id', projectId\)/);
  });

  it('only falls back for exact missing project_deadline column errors', () => {
    const service = source('services/server/projectMutations.ts');
    const repository = source('services/repositories/workflowRepository.ts');

    for (const file of [service, repository]) {
      expect(file).toMatch(/function isMissingProjectDeadlineColumn/);
      expect(file).toMatch(/code === '42703' \|\| code === 'PGRST204'/);
      expect(file).toMatch(/errorText\.includes\('project_deadline'\)/);
    }
  });
});

describe('project deadline migration draft scope', () => {
  it('keeps forward migration narrow and draft-only', () => {
    const forward = source('supabase/drafts/20260718_project_deadline_foundation_forward.sql');

    expect(forward).toMatch(/DRAFT ONLY - DO NOT RUN WITHOUT APPROVAL/);
    expect(forward).toMatch(/begin;/);
    expect(forward).toMatch(/to_regclass\('public\.projects'\)/);
    expect(forward).toMatch(/alter table public\.projects\s+add column if not exists project_deadline date null;/);
    expect(forward).not.toMatch(/create index|add constraint|update public\.projects|alter policy|create policy|public\.tasks|public\.phases|public\.project_members|public\.employees/i);
  });

  it('keeps rollback scoped to project_deadline with a non-null precondition', () => {
    const rollback = source('supabase/drafts/20260718_project_deadline_foundation_rollback.sql');

    expect(rollback).toMatch(/project_deadline is not null/);
    expect(rollback).toMatch(/Rollback blocked/);
    expect(rollback).toMatch(/drop column if exists project_deadline/);
    expect(rollback).not.toMatch(/public\.tasks|public\.phases|public\.project_members|public\.employees/i);
  });

  it('stores post-run and pre-run validation as read-only catalog checks', () => {
    const validation = source('supabase/drafts/20260718_project_deadline_foundation_validation.sql');
    const preRun = source('supabase/drafts/20260718_project_deadline_pre_run_readonly_validation.sql');

    expect(validation).toMatch(/row_count_unchanged/);
    expect(validation).toMatch(/data_type = 'date'/);
    expect(validation).toMatch(/default_is_null/);
    expect(preRun).toMatch(/target_column_conflict/);
    expect(preRun).toMatch(/duplicate_project_name_status_report/);
    expect(preRun).toMatch(/projects_policy_snapshot/);
    expect(`${validation}\n${preRun}`).not.toMatch(/\b(alter|update|delete|insert|drop|create)\b/i);
  });
});

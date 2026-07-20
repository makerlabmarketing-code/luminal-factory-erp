import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('project duplicate-name policy and error mapping', () => {
  it('allows duplicate project names and keeps project identity on stable ids', () => {
    const service = source('services/server/projectMutations.ts');
    const projectPage = source('app/admin/projects/page.tsx');

    expect(service).toMatch(/Duplicate project names are allowed; stable project IDs remain the project identity/);
    expect(service).not.toMatch(/DUPLICATE_BLOCKING_PROJECT_STATUSES/);
    expect(service).not.toMatch(/project_already_exists/);
    expect(service).not.toMatch(/project_duplicate_check_failed/);
    expect(service).not.toMatch(/\.ilike\('project_name', projectName\)\s*\.limit\(1\)/);
    expect(service).not.toMatch(/\.eq\('project_name', projectName\)\s*\.maybeSingle\(\)/);
    expect(service).not.toMatch(/\.eq\('project_name', projectName\)\s*\.single\(\)/);
    expect(projectPage).toMatch(/recordKey/);
    expect(projectPage).toMatch(/project-\$\{item\.project_id\}/);
  });

  it('maps project insert outcomes to the expected API contract', () => {
    const service = source('services/server/projectMutations.ts');
    const route = source('app/api/admin/projects/route.ts');

    expect(service).toMatch(/failureStage: 'project_insert',\s*code: 'project_insert_failed'/);
    expect(service).toMatch(/Không thể tạo dự án\./);
    expect(route).toMatch(/jsonNoStore\(await createProject\(body\), \{ status: 201 \}\)/);
  });

  it('trims names and has project deadline pre/post migration compatibility', () => {
    const service = source('services/server/projectMutations.ts');
    const repository = source('services/repositories/workflowRepository.ts');

    expect(service).toMatch(/const trimmed = value\.trim\(\)/);
    expect(repository).toMatch(/projectName: params\.projectName\.trim\(\)/);
    expect(repository).toMatch(/projectDeadline: params\.projectDeadline/);
    expect(service).toMatch(/project_deadline: params\.projectDeadline/);
    expect(service).toMatch(/deadlinePersisted/);
    expect(service).toMatch(/isMissingProjectDeadlineColumn\(error\)/);
    expect(repository).toMatch(/project_deadline/);
  });

  it('keeps project create UI messages distinct from phase create messages', () => {
    const taskPage = source('app/admin/tasks/page.tsx');
    const projectPage = source('app/admin/projects/page.tsx');

    for (const page of [taskPage, projectPage]) {
      expect(page).not.toMatch(/Dự án này đã tồn tại\./);
      expect(page).not.toMatch(/project_already_exists/);
      expect(page).toMatch(/Bạn không có quyền tạo dự án\./);
      expect(page).toMatch(/Thông tin dự án chưa hợp lệ\./);
      expect(page).toMatch(/Không thể tạo dự án\./);
      expect(page).toMatch(/Không thể lưu giai đoạn\./);
    }
  });

  it('keeps browser project mutations out of the workflow repository', () => {
    const repository = source('services/repositories/workflowRepository.ts');

    expect(repository).not.toMatch(/from\('projects'\)\.insert/);
    expect(repository).not.toMatch(/from\('projects'\)\.update/);
    expect(repository).not.toMatch(/from\('projects'\)\.delete/);
    expect(repository).toMatch(/\/api\/admin\/projects/);
  });

  it('keeps project deadline foundation as draft-only SQL', () => {
    const forwardPath = 'supabase/drafts/20260718_project_deadline_foundation_forward.sql';
    const rollbackPath = 'supabase/drafts/20260718_project_deadline_foundation_rollback.sql';
    const validationPath = 'supabase/drafts/20260718_project_deadline_foundation_validation.sql';

    expect(source(forwardPath)).toMatch(/DRAFT ONLY - DO NOT RUN WITHOUT APPROVAL/);
    expect(source(forwardPath)).toMatch(/add column if not exists project_deadline date null/);
    expect(source(forwardPath)).not.toMatch(/create index|add constraint|update public\.projects|alter policy|create policy/i);
    expect(source(rollbackPath)).toMatch(/drop column if exists project_deadline/);
    expect(source(rollbackPath)).toMatch(/Rollback blocked/);
    expect(source(validationPath)).toMatch(/row_count_unchanged/);
  });
});

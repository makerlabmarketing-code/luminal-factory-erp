import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('project mutation server boundary', () => {
  it('routes project mutations through admin API routes', () => {
    const listRoute = source('app/api/admin/projects/route.ts');
    const detailRoute = source('app/api/admin/projects/[projectId]/route.ts');
    const archiveRoute = source('app/api/admin/projects/[projectId]/archive/route.ts');

    expect(listRoute).toMatch(/createProject/);
    expect(detailRoute).toMatch(/updateProject/);
    expect(archiveRoute).toMatch(/cancelProject/);
    expect(`${listRoute}${detailRoute}${archiveRoute}`).not.toMatch(/actor_employee_id|body\.actor|body\.role|body\.permission/);
  });

  it('keeps browser project mutations out of the workflow repository', () => {
    const repository = source('services/repositories/workflowRepository.ts');

    expect(repository).toMatch(/\/api\/admin\/projects/);
    expect(repository).toMatch(/\/api\/admin\/projects\/\$\{projectId\}\/archive/);
    expect(repository).not.toMatch(/from\(['"]projects['"]\)\.insert/);
    expect(repository).not.toMatch(/from\(['"]projects['"]\)\.update/);
    expect(repository).not.toMatch(/from\(['"]projects['"]\)\.delete/);
    expect(repository).toMatch(/from\(['"]projects['"]\)\.select/);
  });

  it('authorizes project mutations on the server before using the admin client', () => {
    const service = source('services/server/projectMutations.ts');

    expect(service).toMatch(/import 'server-only'/);
    expect(service).toMatch(/requireWorkspaceAccess\('ADMIN_WORKSPACE'\)/);
    expect(service).toMatch(/hasPermission\(authContext, 'PROJECT_MANAGE'\)/);
    expect(service).toMatch(/from\('project_members'\)/);
    expect(service).toMatch(/role_code/);
    expect(service).toMatch(/PROJECT_OWNER/);
    expect(service).toMatch(/PROJECT_MANAGER/);
    expect(service).toMatch(/CREATIVE_LEAD/);
    expect(service).toMatch(/createSupabaseAdminClient/);
    expect(service).not.toMatch(/authUserId.*body|employee_id.*body|actor.*body/);
  });

  it('uses field whitelists and rejects unsafe project payloads', () => {
    const service = source('services/server/projectMutations.ts');

    expect(service).toMatch(/CREATE_PROJECT_KEYS/);
    expect(service).toMatch(/UPDATE_PROJECT_KEYS/);
    expect(service).toMatch(/assertKnownFields/);
    expect(service).toMatch(/owner employee id|membership|actor|role|permission|created_at|updated_at|id/);
    expect(service).toMatch(/PROJECT_OWNER_FIELDS/);
    expect(service).toMatch(/PROJECT_MANAGER_FIELDS/);
  });

  it('cancels projects without hard delete', () => {
    const service = source('services/server/projectMutations.ts');
    const repository = source('services/repositories/workflowRepository.ts');

    expect(service).toMatch(/status: 'CANCELLED'/);
    expect(service).not.toMatch(/\.delete\(\)/);
    expect(repository).not.toMatch(/\.delete\(\)/);
  });

  it('keeps privileged project secrets out of the client path', () => {
    const projectPage = source('app/admin/projects/page.tsx');
    const taskPage = source('app/admin/tasks/page.tsx');
    const repository = source('services/repositories/workflowRepository.ts');

    expect(`${projectPage}${taskPage}${repository}`).not.toMatch(/SUPABASE_SECRET_KEY|createSupabaseAdminClient|utils\/supabase\/admin/);
  });
});

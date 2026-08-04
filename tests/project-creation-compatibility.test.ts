import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = join(__dirname, '..');
const source = (path: string) => readFileSync(join(root, path), 'utf8');

describe('safe project creation compatibility mode', () => {
  const page = source('app/admin/projects/page.tsx');
  const server = source('services/server/projectMutations.ts');
  const route = source('app/api/admin/projects/route.ts');

  it('lazy loads active manager candidates only when the modal opens', () => {
    expect(page).toMatch(/const openCreateModal[\s\S]*setShowAddModal\(true\)[\s\S]*loadCreationOptions/);
    expect(page).toMatch(/onClick=\{openCreateModal\}/);
    expect(server).toMatch(/from\('employees'\)[\s\S]*is_active[\s\S]*INACTIVE/);
    expect(route).toMatch(/GET[\s\S]*getProjectCreationOptions/);
  });

  it('uses an employee selector and submits the stable employee id', () => {
    expect(page).toMatch(/<select[^>]*id="project-manager"/);
    expect(page).toMatch(/employee\.fullName[\s\S]*employee\.title/);
    expect(page).toMatch(/managerEmployeeId: Number\(managerEmployeeId\)/);
    expect(page).not.toMatch(/setStageOwner/);
  });

  it('validates active managers and derives membership actor server-side', () => {
    expect(server).toMatch(/employeeResult\.data\.is_active === false/);
    expect(server).toMatch(/role_code: 'PROJECT_MANAGER'/);
    expect(server).toMatch(/granted_by_employee_id: authEmployeeId\(authContext\)/);
  });

  it('uses the server capability and creates no compatibility phases or tasks', () => {
    expect(server).toMatch(/PROJECT_WORKFLOW_ATOMIC_CREATE_ENABLED/);
    expect(page).toMatch(/setWorkflowCreationAvailable\(payload\?\.workflowCreationAvailable === true\)/);
    expect(page).toMatch(/workflowCreationAvailable \? draftStages : \[\]/);
    expect(server).toMatch(/workflowCreated: false[\s\S]*phasesCreated: 0[\s\S]*tasksCreated: 0/);
  });

  it('keeps product copy free from technical rollout language', () => {
    expect(page).toMatch(/Quy trình dự án chưa được kích hoạt/);
    expect(page).toMatch(/Dự án sẽ được tạo trước/);
    expect(page).not.toMatch(/Cần duyệt RPC|migration|rollout gate/);
  });

  it('blocks duplicate submits and handles partial creation with its returned id', () => {
    expect(page).toMatch(/if \(createProjectLockRef\.current\) return/);
    expect(page).toMatch(/if \(isCreatingProject\) return/);
    expect(page).toMatch(/result\.warnings\.length > 0/);
    expect(page).toMatch(/openProjectDetail\(result\.project\.id\)/);
  });

  it('keeps code uniqueness and duplicate-name policy explicit', () => {
    expect(server).toMatch(/error\?\.code === '23505'\) continue/);
    expect(server).toMatch(/projectCodePrefix\(new Date\(\)\)/);
    expect(server).toMatch(/Duplicate project names are allowed/);
    expect(server).not.toMatch(/\.eq\('project_name', projectName\)/);
  });
});

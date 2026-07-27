import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextProjectCode, projectCodePrefix } from '../lib/project-code';

const root = join(__dirname, '..');
const source = (path: string) => readFileSync(join(root, path), 'utf8');

describe('streamlined project creation and loading', () => {
  const page = source('app/admin/projects/page.tsx');
  const detail = source('app/admin/projects/[projectId]/page.tsx');
  const server = source('services/server/projectMutations.ts');

  it('formats and increments automatic project codes in the business timezone', () => {
    expect(projectCodePrefix('2026-07-26T17:30:00.000Z')).toBe('LF-270726');
    expect(nextProjectCode('LF-270726', [])).toBe('LF-270726-01');
    expect(nextProjectCode('LF-270726', ['LF-270726-01'])).toBe('LF-270726-02');
    expect(nextProjectCode('LF-270726', ['LF-270726-01', 'LF-270726-02'])).toBe('LF-270726-03');
    expect(nextProjectCode('LF-280726', ['LF-270726-03'])).toBe('LF-280726-01');
  });

  it('keeps generation server-owned and retries only duplicate collisions', () => {
    expect(server).not.toMatch(/'projectCode',\s*\n\s*'phases'/);
    expect(server).toMatch(/projectCodePrefix\(new Date\(\)\)/);
    expect(server).toMatch(/error\?\.code === '23505'\) continue/);
    expect(server).toMatch(/rpcCode !== 'duplicate_project_code' && error\?\.code !== '23505'/);
    expect(server).toMatch(/like\('project_code', `\$\{prefix\}-%`\)/);
  });

  it('removes editable project and colorway codes from the create request', () => {
    expect(page).toContain('Mã dự án sẽ được tạo tự động');
    expect(page).not.toMatch(/setProjectCode|setColorwayCode|colorway_code: colorwayCode/);
    expect(page).not.toContain('Mã colorway');
  });

  it('shows accessible inline validation and focuses the first invalid field', () => {
    expect(page).toContain('Vui lòng nhập tên dự án.');
    expect(page).toContain('Vui lòng chọn colorway.');
    expect(page).toContain('Vui lòng chọn hạn hoàn thành.');
    expect(page).toContain('Vui lòng chọn người phụ trách dự án.');
    expect(page).toMatch(/aria-invalid=\{Boolean\(formErrors\.projectName\)\}/);
    expect(page).toMatch(/firstInvalid[\s\S]*\.current\)\?\.focus\(\)/);
    expect(page).toMatch(/disabled=\{isCreatingProject\}[\s\S]*Tạo dự án/);
  });

  it('uses the returned project id and code without a post-create list waterfall', () => {
    const createHandler = page.slice(page.indexOf('const handleCreateProject'), page.indexOf('const handleCancelProject'));
    expect(createHandler).toContain('result.projectId');
    expect(createHandler).toContain('result.projectCode');
    expect(createHandler).toContain('setItems((currentItems)');
    expect(createHandler).not.toContain('await loadData');
  });

  it('uses deduplicated section-only list refresh', () => {
    expect(page).toMatch(/loadPromiseRef\.current/);
    expect(page).toMatch(/onClick=\{\(\) => void loadData\(false\)\}/);
    expect(page).not.toMatch(/window\.location\.reload|router\.refresh/);
  });

  it('renders project core before independent member and task requests settle', () => {
    expect(detail).toMatch(/setItems\(workflowItems\);\s*setLoading\(false\)/);
    expect(detail).toMatch(/void membersRequest\.then/);
    expect(detail).toMatch(/void refreshTasks\(\)/);
    expect(detail).toContain('project_core_timeout');
    expect(detail).toContain('Dự án chưa có giai đoạn.');
    expect(detail).toContain('Hãy thêm giai đoạn để bắt đầu.');
  });
});

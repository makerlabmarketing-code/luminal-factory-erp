import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function source(path: string) {
  return readFileSync(path, 'utf8');
}

describe('project detail operational states', () => {
  it('uses the shared operational state pattern for empty and error states', () => {
    const componentSource = source('component/OperationalState.tsx');
    const projectDetailSource = source('app/admin/projects/[projectId]/page.tsx');

    expect(componentSource).toMatch(/export function OperationalState/);
    expect(componentSource).toMatch(/role="status"/);
    expect(projectDetailSource).toMatch(/import \{ OperationalState \}/);
    expect(projectDetailSource).toMatch(/title="Không thể tải thông tin dự án"/);
    expect(projectDetailSource).toMatch(/title="Dự án chưa có giai đoạn\."/);
    expect(projectDetailSource).toMatch(/title="Chưa có thành viên dự án\."/);
    expect(projectDetailSource).toMatch(/title="Giai đoạn này chưa có công việc\."/);
    expect(projectDetailSource).not.toMatch(/border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">Chưa có thành viên dự án/);
  });

  it('shows authoritative project identity and targeted section retries', () => {
    const projectDetailSource = source('app/admin/projects/[projectId]/page.tsx');

    expect(projectDetailSource).toContain('coreProject.projectCode');
    expect(projectDetailSource).toContain('projectDetail.projectCode');
    expect(projectDetailSource).toContain('Phối màu');
    expect(projectDetailSource).toContain('Thử tải lại giai đoạn');
    expect(projectDetailSource).toContain('Thử tải lại thành viên');
    expect(projectDetailSource).toMatch(/refreshPhases/);
    expect(projectDetailSource).not.toMatch(/window\.location\.reload|location\.reload/);
  });
});

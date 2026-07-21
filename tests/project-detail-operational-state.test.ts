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
    expect(projectDetailSource).toMatch(/title="Không thể tải chi tiết dự án\."/);
    expect(projectDetailSource).toMatch(/title="Dự án chưa có giai đoạn\."/);
    expect(projectDetailSource).toMatch(/title="Chưa có thành viên dự án\."/);
    expect(projectDetailSource).toMatch(/title="Giai đoạn này chưa có công việc\."/);
    expect(projectDetailSource).not.toMatch(/border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">Chưa có thành viên dự án/);
  });
});

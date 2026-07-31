import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'app/staff/tasks/TasksView.tsx'), 'utf8');

describe('staff task loading resilience', () => {
  it('does not bind the loader to the selected project and trigger a duplicate initial request', () => {
    expect(source).toMatch(/setSelectedProjectName\(\(currentProjectName\) =>/);
    expect(source).toMatch(/\}, \[workerData\]\);/);
    expect(source).not.toMatch(/\}, \[workerData, selectedProjectName\]\);/);
  });

  it('reports failed refreshes and synchronously blocks duplicate refresh requests', () => {
    expect(source).toContain('if (refreshLockRef.current) return;');
    expect(source).toContain("else showToast('Không thể tải công việc', 'Vui lòng thử lại.', 'error');");
    expect(source).toContain('Dữ liệu đang hiển thị có thể chưa được cập nhật.');
    expect(source).toContain('disabled={isRefreshing}');
  });
});

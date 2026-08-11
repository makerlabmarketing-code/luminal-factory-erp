import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('task comment textarea', () => {
  it('renders the progress comment field as a textarea', () => {
    const staffTasksView = source('app/staff/tasks/TasksView.tsx');

    expect(staffTasksView).toMatch(/<textarea/);
    expect(staffTasksView).toMatch(/rows=\{4\}/);
    expect(staffTasksView).toMatch(/Nhập báo cáo tiến độ gửi sếp/);
    expect(staffTasksView).not.toMatch(/type="number"[\s\S]{0,240}taskBuffer\.note/);
  });

  it('guards whitespace-only submit and double submit', () => {
    const staffTasksView = source('app/staff/tasks/TasksView.tsx');

    expect(staffTasksView).toMatch(/savingTaskKey/);
    expect(staffTasksView).toMatch(/if \(savingTaskKey === targetKey\) return/);
    expect(staffTasksView).toMatch(/if \(!bufferedData\.note\.trim\(\)\)/);
    expect(staffTasksView).toMatch(/disabled=\{isSavingThisTask\}/);
  });

  it('trims only on submit, resets after success, and keeps content on error', () => {
    const staffTasksView = source('app/staff/tasks/TasksView.tsx');
    const staffTasksService = source('services/staffTasksService.ts');

    expect(staffTasksView).toMatch(/note: bufferedData\.note\.trim\(\)/);
    expect(staffTasksView).toMatch(/setEditableTasks\(\(prev\) => \(\{/);
    expect(staffTasksView).toMatch(/note: ''/);
    expect(staffTasksView).toMatch(/catch \(error\)/);
    expect(staffTasksService).toMatch(/const note = params\.bufferedTask\.note\.trim\(\)/);
    expect(staffTasksService).toMatch(/body: JSON\.stringify\(\{[\s\S]*note,/);
  });
});

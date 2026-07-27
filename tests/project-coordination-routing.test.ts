import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const source = (path: string) => readFileSync(join(root, path), 'utf8');

describe('project coordination route contract', () => {
  it('uses one canonical admin workspace and preserves legacy query parameters', () => {
    const legacyPage = source('app/admin/tasks/page.tsx');
    const shell = source('app/admin/AdminShell.tsx');

    expect(legacyPage).toMatch(/redirect\(`\/admin\/projects/);
    expect(legacyPage).toMatch(/URLSearchParams/);
    expect(shell).toContain('Dự án & công việc');
    expect(shell).not.toContain('Công việc & tiến độ');
  });

  it('generates the canonical URL for both project-list navigation actions', () => {
    const list = source('app/admin/projects/page.tsx');
    expect(list).toMatch(/const openProjectDetail[\s\S]*router\.push\(`\/admin\/projects\/\$\{normalizedProjectId\}`\)/);
    expect(list.match(/openProjectDetail\((?:project|activeProject)\.id\)/g)).toHaveLength(2);
    expect(list).toContain('Quản lý chi tiết');
  });

  it('distinguishes invalid, forbidden, missing and section-level failures', () => {
    const detail = source('app/admin/projects/[projectId]/page.tsx');
    const notFound = source('app/admin/projects/[projectId]/not-found.tsx');

    expect(detail).toContain('Mã dự án không hợp lệ.');
    expect(detail).toContain('Bạn không có quyền xem dự án này');
    expect(detail).toMatch(/notFoundConfirmed[\s\S]{0,60}notFound\(\)/);
    expect(detail).toContain('Không thể tải thành viên dự án.');
    expect(notFound).toContain('Quay lại danh sách');
  });

  it('cancels locally, blocks duplicate submission and uses approved copy', () => {
    const list = source('app/admin/projects/page.tsx');
    const detail = source('app/admin/projects/[projectId]/page.tsx');
    const combined = `${list}\n${detail}`;

    expect(combined).toContain('Huỷ dự án này?');
    expect(combined).toContain('Xác nhận huỷ');
    expect(combined).toContain('Đã huỷ dự án');
    expect(combined).toContain('Dự án đã được chuyển sang trạng thái Đã huỷ và vẫn được lưu trong lịch sử.');
    expect(combined).not.toContain('Dự án không bị xóa khỏi dữ liệu.');
    expect(detail).toMatch(/isProjectCancelled \|\| isCancellingProject/);
    expect(detail).not.toMatch(/router\.refresh\(\)|window\.location\.reload\(\)/);
  });

  it('renders global stacked notifications below the header and above overlays', () => {
    const notifications = source('component/NotificationContext.tsx');
    expect(notifications).toMatch(/fixed left-3 right-3 top-24/);
    expect(notifications).toMatch(/toasts\.map/);
    expect(notifications).toMatch(/OVERLAY_Z_INDEX\.notification/);
    expect(notifications).toContain('aria-label="Đóng thông báo"');
  });
});

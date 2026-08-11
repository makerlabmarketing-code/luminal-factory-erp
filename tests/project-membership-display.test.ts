import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync('app/admin/projects/[projectId]/page.tsx', 'utf8');
const sectionSource = readFileSync('app/admin/projects/[projectId]/ProjectMembershipSection.tsx', 'utf8');

describe('Project Membership display completion', () => {
  it('uses the server summary instead of deriving every role from page state', () => {
    expect(pageSource).toContain('ProjectMembershipResponseDTO');
    expect(pageSource).toContain('setMembershipSummary(payload.summary || null)');
    expect(sectionSource).toContain('summary.ownerCount');
    expect(sectionSource).toContain('summary.managerCount');
    expect(sectionSource).toContain('summary.creativeLeadCount');
    expect(sectionSource).toContain('summary.contributorCount');
  });

  it('shows the project code and a data-backed missing-owner warning', () => {
    expect(sectionSource).toContain('summary?.projectCode');
    expect(sectionSource).toContain('summary && !summary.hasActiveOwner');
    expect(sectionSource).toContain('Dự án chưa có Chủ dự án đang hoạt động.');
  });

  it('separates active members from soft-revoked history', () => {
    expect(sectionSource).toContain("member.status === 'ACTIVE'");
    expect(sectionSource).toContain("member.status === 'REVOKED'");
    expect(sectionSource).toContain('Lịch sử thu hồi');
    expect(sectionSource).toContain('<details');
  });

  it('owns local loading, stale-data error, retry and empty states', () => {
    expect(sectionSource).toContain('MembershipSkeleton');
    expect(sectionSource).toContain('Dữ liệu đã tải trước đó vẫn được giữ lại.');
    expect(sectionSource).toContain('onClick={onRetry}');
    expect(sectionSource).toContain('Chưa có thành viên đang hoạt động.');
  });

  it('uses the same targeted refresh after initial load and mutations', () => {
    expect(pageSource).toContain('const refreshMembers = useCallback');
    expect(pageSource).toContain('void refreshMembers(true)');
    expect(pageSource.match(/await refreshMembers\(\)/g)).toHaveLength(3);
    expect(pageSource).not.toMatch(/router\.refresh\(\)|window\.location\.reload/);
  });

  it('keeps touch actions at least 44 pixels high', () => {
    expect(sectionSource.match(/min-h-11/g)?.length).toBeGreaterThanOrEqual(4);
  });
});

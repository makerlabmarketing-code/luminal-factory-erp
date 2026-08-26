import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function source(relativePath: string): string {
  return readFileSync(relativePath, 'utf8');
}

describe('dashboard UI wave two', () => {
  it('uses shared presentation patterns without changing the dashboard DTO boundary', () => {
    const dashboardPage = source('app/admin/dashboard/page.tsx');
    const dashboardCharts = source('app/admin/dashboard/AdminDashboardCharts.tsx');
    const sharedUi = source('component/AdminUI.tsx');

    expect(dashboardPage).toMatch(/getAdminDashboardDto\(\)/);
    expect(dashboardPage).toMatch(/AdminPageHeader/);
    expect(dashboardCharts).toMatch(/AdminMetricCard/);
    expect(dashboardCharts).toMatch(/AdminPanelHeader/);
    expect(sharedUi).toMatch(/export function AdminMetricCard/);
    expect(sharedUi).toMatch(/export function AdminPanel/);
  });

  it('keeps charts readable on narrow screens and exposes true empty states', () => {
    const dashboardCharts = source('app/admin/dashboard/AdminDashboardCharts.tsx');

    expect(dashboardCharts).toMatch(/overflow-x-auto/);
    expect(dashboardCharts).toMatch(/min-w-\[560px\]/);
    expect(dashboardCharts).toMatch(/Chưa có dòng tiền đã thanh toán để hiển thị theo kỳ\./);
    expect(dashboardCharts).toMatch(/Chưa có dữ liệu cơ cấu dòng tiền\./);
  });

  it('keeps retry local and uses the shared Luminal loading mark', () => {
    const dashboardCharts = source('app/admin/dashboard/AdminDashboardCharts.tsx');

    expect(dashboardCharts).toMatch(/startTransition\(\(\) => router\.refresh\(\)\)/);
    expect(dashboardCharts).toMatch(/LuminalLoadingMark compact/);
    expect(dashboardCharts).not.toMatch(/window\.location|location\.reload/);
  });
});

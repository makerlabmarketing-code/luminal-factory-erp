import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_ORDER_STATUS_LABELS,
  PRODUCTION_PRIORITY_LABELS,
  PRODUCTION_STAGE_STATUS_LABELS,
} from '../lib/production-order-workflow';
import { filterAdminNavigation } from '../lib/navigation/admin';

const root = join(__dirname, '..');
const source = (relativePath: string) => readFileSync(join(root, relativePath), 'utf8');

describe('Phase 7 production order read model', () => {
  it('shows Production Orders only to project-authorized Admin navigation', () => {
    const withoutProjects = filterAdminNavigation([]).flatMap((group) => group.items.map((item) => item.path));
    const projectViewer = filterAdminNavigation(['PROJECT_VIEW']).flatMap((group) => group.items.map((item) => item.path));
    const projectManager = filterAdminNavigation(['PROJECT_MANAGE']).flatMap((group) => group.items.map((item) => item.path));

    expect(withoutProjects).not.toContain('/admin/production-orders');
    expect(projectViewer).toContain('/admin/production-orders');
    expect(projectManager).toContain('/admin/production-orders');
  });

  it('keeps reads server-owned, request-scoped, and RLS preserving', () => {
    const service = source('services/server/productionOrders.ts');

    expect(service).toMatch(/requireWorkspaceAccess\('ADMIN_WORKSPACE'\)/);
    expect(service).toMatch(/hasPermission\(authContext, 'PROJECT_VIEW'\)/);
    expect(service).toMatch(/hasPermission\(authContext, 'PROJECT_MANAGE'\)/);
    expect(service).toMatch(/createSupabaseServerClient/);
    expect(service).toMatch(/production_order_list_view/);
    expect(service).toMatch(/production_order_detail_view/);
    expect(service).not.toMatch(/createSupabaseAdminClient|service_role|\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
  });

  it('exposes GET-only routes with no-store responses and safe UUID validation', () => {
    const listRoute = source('app/api/admin/production-orders/route.ts');
    const detailRoute = source('app/api/admin/production-orders/[productionOrderId]/route.ts');
    const routes = `${listRoute}\n${detailRoute}`;

    expect(listRoute).toMatch(/export async function GET/);
    expect(detailRoute).toMatch(/export async function GET/);
    expect(detailRoute).toMatch(/UUID_PATTERN/);
    expect(routes).toMatch(/Cache-Control', 'no-store'/);
    expect(routes).not.toMatch(/export async function (POST|PATCH|PUT|DELETE)/);
  });

  it('uses canonical Vietnamese status and priority labels', () => {
    expect(PRODUCTION_ORDER_STATUS_LABELS.IN_PRODUCTION).toBe('Đang sản xuất');
    expect(PRODUCTION_ORDER_STATUS_LABELS.BLOCKED).toBe('Bị vướng');
    expect(PRODUCTION_STAGE_STATUS_LABELS.PENDING_REVIEW).toBe('Chờ duyệt');
    expect(PRODUCTION_PRIORITY_LABELS.URGENT).toBe('Khẩn cấp');
  });

  it('provides responsive list/detail states without enabling mutations', () => {
    const listPage = source('app/admin/production-orders/page.tsx');
    const detailPage = source('app/admin/production-orders/[productionOrderId]/page.tsx');
    const loading = source('app/admin/production-orders/loading.tsx');
    const pages = `${listPage}\n${detailPage}`;

    expect(listPage).toMatch(/md:hidden/);
    expect(listPage).toMatch(/hidden overflow-x-auto md:block/);
    expect(listPage).toContain('Không tìm thấy kết quả');
    expect(listPage).toContain('Chưa có lệnh sản xuất nào');
    expect(detailPage).toContain('Tiến trình sản xuất');
    expect(detailPage).toContain('Thông tin tham chiếu ở chế độ chỉ xem.');
    expect(loading).toContain('CenteredPageLoading');
    expect(pages).not.toMatch(/Tạo lệnh|Chuyển trạng thái|fetch\([^\n]+method:\s*['"](POST|PATCH|PUT|DELETE)/);
  });
});

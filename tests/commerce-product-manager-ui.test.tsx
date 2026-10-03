import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CommerceProductRecord } from '../lib/commerce-admin/contracts';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/commerce-admin/mutation-retry', () => import('../lib/commerce-admin/mutation-retry'));
vi.mock('@/lib/commerce-admin/product-input', () => import('../lib/commerce-admin/product-input'));
vi.mock('@/lib/commerce-admin/translation-input', () => import('../lib/commerce-admin/translation-input'));
import ProductManagerClient from '../app/admin/commerce/products/ProductManagerClient';
const product: CommerceProductRecord = { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Meowhe', slug: 'meowhe', description: null, product_type: 'artisan_keycap', release_type: 'informational', status: 'draft', published_at: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };
describe('Product manager access and list states', () => {
  it('shows draft editing only to a manager and leaves published products intact', () => {
    const viewer = renderToStaticMarkup(<ProductManagerClient initialProducts={[product]} canManage={false} integrationEnabled loadError={null} />);
    expect(viewer).not.toContain('Tạo mới'); expect(viewer).not.toContain('Chỉnh sửa'); expect(viewer).toContain('Meowhe');
    const manager = renderToStaticMarkup(<ProductManagerClient initialProducts={[product, { ...product, id: 'published', status: 'published' }]} canManage integrationEnabled loadError={null} />);
    expect(manager).toContain('Tạo mới'); expect(manager.match(/Chỉnh sửa/g)).toHaveLength(1);
  });
  it('distinguishes disabled, empty and failed reads', () => {
    const disabled = renderToStaticMarkup(<ProductManagerClient initialProducts={[]} canManage integrationEnabled={false} loadError={null} />);
    expect(disabled).toContain('Kết nối Commerce đang tắt');
    const failed = renderToStaticMarkup(<ProductManagerClient initialProducts={[]} canManage={false} integrationEnabled loadError="Không thể tải danh mục sản phẩm." />);
    expect(failed).toContain('role="alert"'); expect(failed).toContain('Danh sách chưa tải được');
    const empty = renderToStaticMarkup(<ProductManagerClient initialProducts={[]} canManage={false} integrationEnabled loadError={null} />);
    expect(empty).toContain('Chưa có sản phẩm trong danh mục');
  });
});

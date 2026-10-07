import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CommerceProductRecord } from '../lib/commerce-admin/contracts';
vi.mock('@/component/NotificationContext', () => ({ useNotification: () => ({ showToast: vi.fn(), showConfirm: vi.fn() }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/commerce-admin/mutation-retry', () => import('../lib/commerce-admin/mutation-retry'));
vi.mock('@/lib/commerce-admin/product-input', () => import('../lib/commerce-admin/product-input'));
vi.mock('@/lib/commerce-admin/translation-input', () => import('../lib/commerce-admin/translation-input'));
vi.mock('@/lib/commerce-admin/colorway-input', () => import('../lib/commerce-admin/colorway-input'));
vi.mock('@/lib/commerce-admin/use-commerce-feedback', () => import('../lib/commerce-admin/use-commerce-feedback'));
vi.mock('@/lib/commerce-admin/media-input', () => import('../lib/commerce-admin/media-input'));
vi.mock('@/lib/commerce-admin/prepare-media-file', () => import('../lib/commerce-admin/prepare-media-file'));
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
  it('keeps all product editors out of the list and links each product to its own route', () => {
    const list = renderToStaticMarkup(<ProductManagerClient initialProducts={[product]} canManage integrationEnabled loadError={null} />);
    expect(list).toContain(`/admin/commerce/products/${product.id}`);
    expect(list).toContain('/admin/commerce/products/new');
    expect(list).not.toContain('Ảnh sản phẩm và phối màu');
    expect(list).not.toContain('Bản dịch bổ sung');
    expect(list).not.toContain('Phối màu theo sản phẩm');
    expect(list).not.toContain('<form');
  });
  it('shows only the selected product editors without a product picker or list', () => {
    const detail = renderToStaticMarkup(<ProductManagerClient initialProducts={[product]} selectedProduct={product} editor canManage integrationEnabled mediaEnabled loadError={null} />);
    expect(detail).toContain('Thông tin sản phẩm');
    expect(detail).toContain('Ảnh sản phẩm và phối màu');
    expect(detail).toContain('Bản dịch bổ sung');
    expect(detail).toContain('Phối màu theo sản phẩm');
    expect(detail).not.toContain('Chọn sản phẩm');
    expect(detail).not.toContain('Tìm sản phẩm');
    expect(detail).not.toContain('<table');
    expect(detail).toContain('Quay lại danh sách');
  });
  it.each(['published', 'archived'] as const)('gates %s information writes while still allowing detail access', status => {
    const selected = { ...product, status };
    const pending = renderToStaticMarkup(<ProductManagerClient initialProducts={[selected]} selectedProduct={selected} editor canManage integrationEnabled loadError={null} />);
    expect(pending).toContain('Thông tin hiện chỉ xem');
    expect(pending).not.toContain('Lưu thay đổi');
    const enabled = renderToStaticMarkup(<ProductManagerClient initialProducts={[selected]} selectedProduct={selected} editor canManage informationUpdateEnabled integrationEnabled loadError={null} />);
    expect(enabled).toContain('Lưu thay đổi');
    expect(enabled).toContain('disabled="" required="" maxLength="120"');
    const viewer = renderToStaticMarkup(<ProductManagerClient initialProducts={[selected]} selectedProduct={selected} editor canManage={false} informationUpdateEnabled integrationEnabled loadError={null} />);
    expect(viewer).not.toContain('Lưu thay đổi');
  });
  it('requires a confirmed product before showing media, colorway or translation editors on create', () => {
    const create = renderToStaticMarkup(<ProductManagerClient initialProducts={[]} editor canManage integrationEnabled loadError={null} />);
    expect(create).toContain('Sản phẩm mới');
    expect(create).toContain('Lưu nháp');
    expect(create).not.toContain('Chọn sản phẩm');
    expect(create).not.toContain('Ảnh sản phẩm và phối màu');
    expect(create).not.toContain('<table');
  });
  it('can display a legacy published keycap without silently changing its release type', () => {
    const selected = { ...product, status: 'published' as const, release_type: 'direct' };
    const html = renderToStaticMarkup(<ProductManagerClient initialProducts={[selected]} selectedProduct={selected} editor canManage informationUpdateEnabled integrationEnabled loadError={null} />);
    expect(html).toContain('Thông tin sản phẩm');
    expect(html).toContain('value="direct" selected=""');
    expect(html).toContain('Lưu thay đổi');
  });
});

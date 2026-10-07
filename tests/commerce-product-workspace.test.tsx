import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
const runtime = vi.hoisted(() => ({ access: vi.fn(), permission: vi.fn(), list: vi.fn(), enabled: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/services/server/commerceAdminProducts', () => ({ listCommerceProducts: runtime.list }));
vi.mock('@/services/server/commerceAdminProductAccess', () => ({ requireCommerceProductAccess: runtime.access }));
vi.mock('@/services/server/auth', () => ({ hasPermission: runtime.permission, AuthFlowError: class extends Error {} }));
vi.mock('@/services/server/commerceAdminIntegration', () => ({ isCommerceAdminIntegrationEnabled: runtime.enabled }));
vi.mock('../app/admin/commerce/products/ProductManagerClient', () => ({ default: (props: { initialProducts: { id: string }[]; editor: boolean }) => <div data-editor={props.editor}>{props.initialProducts.map(row => row.id).join(',')}</div> }));
import ProductWorkspace from '../app/admin/commerce/products/ProductWorkspace';
const id = '550e8400-e29b-41d4-a716-446655440000';
afterEach(() => vi.resetAllMocks());
function setup() { runtime.access.mockResolvedValue({}); runtime.permission.mockResolvedValue(true); runtime.enabled.mockReturnValue(true); runtime.list.mockResolvedValue([{ id }, { id: 'other-product' }]); }
describe('Product workspace server boundaries', () => {
  it('checks access before reading and passes only the selected product to detail', async () => {
    setup();
    const html = renderToStaticMarkup(await ProductWorkspace({ productId: id }));
    expect(runtime.access).toHaveBeenCalledWith('COMMERCE_PRODUCT_VIEW');
    expect(html).toContain(id); expect(html).not.toContain('other-product');
    expect(html).toContain('data-editor="true"');
  });
  it('does not read Commerce when create or denied', async () => {
    setup();
    await ProductWorkspace({ create: true });
    expect(runtime.access).toHaveBeenCalledWith('COMMERCE_PRODUCT_MANAGE');
    expect(runtime.list).not.toHaveBeenCalled();
    runtime.access.mockRejectedValue(new Error('denied'));
    const html = renderToStaticMarkup(await ProductWorkspace({ productId: id }));
    expect(html).toContain('role="alert"'); expect(runtime.list).not.toHaveBeenCalled();
  });
  it('distinguishes a missing product, failed read and disabled connection', async () => {
    setup();
    expect(renderToStaticMarkup(await ProductWorkspace({ productId: 'missing' }))).toContain('Không tìm thấy sản phẩm');
    runtime.list.mockRejectedValue(new Error('failed'));
    expect(renderToStaticMarkup(await ProductWorkspace({ productId: id }))).toContain('Không thể tải danh mục');
    runtime.enabled.mockReturnValue(false);
    expect(renderToStaticMarkup(await ProductWorkspace({ productId: id }))).toContain('Kết nối Commerce đang tắt');
  });
});

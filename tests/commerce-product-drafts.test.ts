import { afterEach, describe, expect, it, vi } from 'vitest';
import { commerceProductEndpoints } from '../lib/commerce-admin/contracts';
import { isProductRecord, parseCommerceProductDraftMutation } from '../lib/commerce-admin/product-input';

const runtime = vi.hoisted(() => ({ access: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/commerce-admin/product-input', () => import('../lib/commerce-admin/product-input'));
vi.mock('@/services/server/commerceAdminProductAccess', () => ({ requireCommerceProductAccess: runtime.access }));
vi.mock('@/services/server/commerceAdminProducts', () => ({ listCommerceProducts: vi.fn(), createCommerceProductDraft: runtime.create, updateCommerceProductDraft: runtime.update }));
vi.mock('@/services/server/commerceAdminRouteResponse', () => ({ commerceAdminJson: (body: unknown, init?: ResponseInit) => Response.json(body, init), commerceAdminRouteError: () => Response.json({ success: false }, { status: 403 }) }));
import { POST } from '../app/api/admin/commerce/products/route';
import { PATCH } from '../app/api/admin/commerce/products/[id]/route';

const operationId = '550e8400-e29b-41d4-a716-446655440000';
const draft = { name: ' Meowhe ', slug: ' meowhe ', description: ' Test ', productType: 'artisan_keycap', releaseType: 'informational' };
const mutation = { operationId, draft };
const request = (body: unknown) => new Request('https://erp.test/api/admin/commerce/products', { method: 'POST', body: JSON.stringify(body) });
const params = { params: Promise.resolve({ id: operationId }) };
afterEach(() => vi.resetAllMocks());

describe('Product draft wire validation', () => {
  it('normalizes the same fields as Commerce and separates write permission', () => {
    const parsed = parseCommerceProductDraftMutation(mutation)!;
    expect(parsed.draft).toEqual({ ...draft, name: 'Meowhe', slug: 'meowhe', description: 'Test' });
    expect(commerceProductEndpoints.create(parsed)).toMatchObject({ capability: 'COMMERCE_PRODUCT_MANAGE', scope: 'commerce.product.write', method: 'POST', body: parsed });
    expect(commerceProductEndpoints.update(operationId, parsed)).toMatchObject({ method: 'PATCH', path: `/api/admin/v1/products/${operationId}` });
  });
  it.each(['direct', 'preorder'])('rejects keycap release %s', releaseType => {
    expect(parseCommerceProductDraftMutation({ ...mutation, draft: { ...draft, releaseType } })).toBeNull();
  });
  it('preserves legacy release metadata only under the explicit information-update parser', () => {
    const legacy = { ...mutation, draft: { ...draft, releaseType: 'direct' } };
    expect(parseCommerceProductDraftMutation(legacy)).toBeNull();
    expect(parseCommerceProductDraftMutation(legacy, true)?.draft.releaseType).toBe('direct');
    expect(parseCommerceProductDraftMutation({ ...legacy, draft: { ...legacy.draft, price: 1 } }, true)).toBeNull();
  });
  it.each([
    { operationId: 'invalid' }, { extra: true },
    { draft: { ...draft, name: ' ' } }, { draft: { ...draft, slug: 'Meowhe/' } },
    { draft: { ...draft, description: 'x'.repeat(5001) } },
    { draft: { ...draft, price: 7000 } }, { draft: { ...draft, productType: 'unknown' } },
  ])('rejects malformed or out-of-scope input %j', change => {
    expect(parseCommerceProductDraftMutation({ ...mutation, ...change })).toBeNull();
  });
  it('permits a non-keycap preorder and an omitted description', () => {
    expect(parseCommerceProductDraftMutation({ operationId, draft: { slug: 'toy', name: 'Toy', productType: 'collectible_object', releaseType: 'preorder' } })?.draft.description).toBeNull();
  });
  it('rejects an incomplete success record', () => {
    expect(isProductRecord({ id: operationId, status: 'draft' })).toBe(false);
  });
});

describe('ERP Product draft routes', () => {
  it('rejects denied access before parsing the body or calling Commerce', async () => {
    runtime.access.mockRejectedValue(new Error('denied'));
    const input = request(mutation); const read = vi.spyOn(input, 'json');
    expect((await POST(input)).status).toBe(403);
    expect(read).not.toHaveBeenCalled(); expect(runtime.create).not.toHaveBeenCalled();
    expect((await PATCH(request(mutation), params)).status).toBe(403);
    expect(runtime.update).not.toHaveBeenCalled();
  });
  it('rejects malformed JSON and unsafe IDs without a remote write', async () => {
    runtime.access.mockResolvedValue({});
    expect((await POST(new Request('https://erp.test', { method: 'POST', body: '{' }))).status).toBe(400);
    expect((await PATCH(request(mutation), { params: Promise.resolve({ id: '../publish' }) })).status).toBe(400);
    expect(runtime.create).not.toHaveBeenCalled(); expect(runtime.update).not.toHaveBeenCalled();
  });
  it('forwards the retained operation ID and confirms the returned record', async () => {
    runtime.access.mockResolvedValue({}); runtime.create.mockResolvedValue({ id: operationId, status: 'draft' });
    runtime.update.mockResolvedValue({ id: operationId, status: 'draft' });
    expect((await POST(request(mutation))).status).toBe(201);
    expect(runtime.access).toHaveBeenCalledWith('COMMERCE_PRODUCT_MANAGE');
    expect(runtime.create).toHaveBeenCalledWith(parseCommerceProductDraftMutation(mutation));
    expect((await PATCH(request(mutation), params)).status).toBe(200);
    expect(runtime.update).toHaveBeenCalledWith(operationId, parseCommerceProductDraftMutation(mutation));
  });
});

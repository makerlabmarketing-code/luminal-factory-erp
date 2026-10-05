import { afterEach, describe, expect, it, vi } from 'vitest';
import { commerceColorwayEndpoints } from '../lib/commerce-admin/contracts';
import { isColorwayRecord, parseColorwayMutation } from '../lib/commerce-admin/colorway-input';
const state = vi.hoisted(() => ({ access: vi.fn(), list: vi.fn(), save: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/commerce-admin/product-input', () => import('../lib/commerce-admin/product-input'));
vi.mock('@/lib/commerce-admin/colorway-input', () => import('../lib/commerce-admin/colorway-input'));
vi.mock('@/services/server/commerceAdminProductAccess', () => ({ requireCommerceProductAccess: state.access }));
vi.mock('./commerceAdminProductAccess', () => ({ requireCommerceProductAccess: state.access }));
vi.mock('../services/server/commerceAdminProductAccess', () => ({ requireCommerceProductAccess: state.access }));
vi.mock('../services/server/commerceAdminColorways', () => ({ listCommerceColorways: state.list, saveCommerceColorway: state.save }));
vi.mock('../services/server/commerceAdminRouteResponse', () => ({ commerceAdminJson: (body: unknown, init?: ResponseInit) => Response.json(body, init), commerceAdminRouteError: () => Response.json({ success: false }, { status: 403 }) }));
import { handleERPColorway } from '../services/server/commerceAdminColorwayRoute';
const id = '550e8400-e29b-41d4-a716-446655440000';
const input = { operationId: id, draft: { name: ' Lolipop ', slug: ' lolipop ', description: ' Test ' } };
const params = Promise.resolve({ id });
const request = (body: unknown = input, method = 'POST') => new Request('https://erp.test', { method, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) });
afterEach(() => vi.resetAllMocks());
describe('Colorway draft contract and route boundary', () => {
  it('normalizes strict fields and reuses separately authorized Product scopes', () => {
    const mutation = parseColorwayMutation(input)!;
    expect(mutation.draft).toEqual({ name: 'Lolipop', slug: 'lolipop', description: 'Test' });
    expect(commerceColorwayEndpoints.save(id, null, mutation)).toMatchObject({ capability: 'COMMERCE_PRODUCT_MANAGE', scope: 'commerce.product.write', method: 'POST' });
    expect(commerceColorwayEndpoints.list(id).scope).toBe('commerce.product.read');
  });
  it.each(['price', 'isActive', 'productId', 'stock', 'sku'])('rejects field %s', key => {
    expect(parseColorwayMutation({ ...input, draft: { ...input.draft, [key]: 1 } })).toBeNull();
  });
  it('rejects invalid IDs, slugs and bounds', () => {
    for (const draft of [{ name: '', slug: 'x' }, { name: 'x', slug: '../x' }, { name: 'x', slug: 'x', description: 'x'.repeat(5001) }]) expect(parseColorwayMutation({ ...input, draft })).toBeNull();
    expect(isColorwayRecord({ id, product_id: id })).toBe(false);
  });
  it('denies before reading JSON or calling Commerce', async () => {
    state.access.mockRejectedValue(new Error('denied'));
    const req = request(); const json = vi.spyOn(req, 'json');
    expect((await handleERPColorway(req, params)).status).toBe(403);
    expect(json).not.toHaveBeenCalled(); expect(state.save).not.toHaveBeenCalled();
  });
  it('validates route IDs and retains the operation ID through the transport', async () => {
    state.access.mockResolvedValue({}); state.save.mockResolvedValue({ id });
    expect((await handleERPColorway(request(), Promise.resolve({ id: '../other' }))).status).toBe(400);
    expect(state.save).not.toHaveBeenCalled();
    expect((await handleERPColorway(request(), params)).status).toBe(201);
    expect(state.save).toHaveBeenCalledWith(id, null, parseColorwayMutation(input));
    expect(state.access).toHaveBeenCalledWith('COMMERCE_PRODUCT_MANAGE');
  });
  it('uses view permission for lists', async () => {
    state.access.mockResolvedValue({}); state.list.mockResolvedValue([]);
    expect((await handleERPColorway(request(undefined, 'GET'), params)).status).toBe(200);
    expect(state.access).toHaveBeenCalledWith('COMMERCE_PRODUCT_VIEW');
  });
});

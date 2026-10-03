import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyTranslation, matchesTranslationTarget, parseTranslationDraft, parseTranslationMutation, translationEndpoint } from '../lib/commerce-admin/translation-input';
const runtime = vi.hoisted(() => ({ access: vi.fn(), read: vi.fn(), save: vi.fn(), transport: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/commerce-admin/translation-input', () => import('../lib/commerce-admin/translation-input'));
vi.mock('@/lib/commerce-admin/product-input', () => import('../lib/commerce-admin/product-input'));
vi.mock('../services/server/commerceAdminProductAccess', () => ({ requireCommerceProductAccess: runtime.access }));
vi.mock('../services/server/commerceAdminIntegration', () => ({ requestCommerceAdmin: runtime.transport }));
vi.mock('../services/server/commerceAdminRouteResponse', () => ({ commerceAdminJson: (body: unknown, init?: ResponseInit) => Response.json(body, init), commerceAdminRouteError: () => Response.json({ success: false }, { status: 403 }) }));
import { readCommerceTranslation, saveCommerceTranslation } from '../services/server/commerceAdminTranslations';
import { handleErpTranslationRoute } from '../services/server/commerceAdminTranslationRoute';
const id = '550e8400-e29b-41d4-a716-446655440000';
const target = { productId: id, variantId: null, locale: 'vi' as const };
const draft = { ...emptyTranslation(), content: { ...emptyTranslation().content, title: ' Meowhe ', description: ' Câu chuyện ' }, ready: true };
const normalized = parseTranslationDraft(draft)!;
const mutation = { operationId: id, expectedRevision: 0, draft: normalized };
const row = { ...target, ...normalized, revision: 1, updatedAt: '2026-10-03T00:00:00Z' };
afterEach(() => vi.resetAllMocks());
describe('translation ownership, readiness and parser limits', () => {
  it('permits incomplete drafts but not ready incomplete content', () => {
    expect(parseTranslationDraft(emptyTranslation())).not.toBeNull();
    expect(parseTranslationDraft({ ...emptyTranslation(), ready: true })).toBeNull();
    expect(parseTranslationDraft(draft)).toEqual(normalized);
  });
  it.each([
    { operationId: 'invalid' }, { expectedRevision: -1 }, { expectedRevision: 0.5 }, { expectedRevision: 2147483647 },
    { price: 50 }, { draft: { ...draft, content: { ...draft.content, slug: 'new-slug' } } },
    { draft: { ...draft, content: { ...draft.content, title: 'x'.repeat(161) } } },
  ])('rejects malformed or commerce-changing payload %j', change => expect(parseTranslationMutation({ ...mutation, ...change })).toBeNull());
  it('uses existing scope/capability and a shared entity ID', () => {
    expect(translationEndpoint(target)).toMatchObject({ capability: 'COMMERCE_PRODUCT_VIEW', scope: 'commerce.product.read' });
    expect(translationEndpoint(target, mutation)).toMatchObject({ capability: 'COMMERCE_PRODUCT_MANAGE', scope: 'commerce.product.write', method: 'PATCH' });
    expect(translationEndpoint({ ...target, variantId: id }).path).toContain(`/products/${id}/colorways/${id}/translations/vi`);
  });
  it('rejects cross-entity or cross-locale responses', () => {
    expect(matchesTranslationTarget(row, target)).toBe(true);
    expect(matchesTranslationTarget({ ...row, locale: 'en' }, target)).toBe(false);
    expect(matchesTranslationTarget({ ...row, variantId: id }, target)).toBe(false);
  });
});
describe('translation transport response validation', () => {
  it('confirms revision and content without depending on JSON key order', async () => {
    runtime.transport.mockImplementation(async (_endpoint, validate: (value: unknown) => boolean) => {
      expect(validate({ ...row, content: Object.fromEntries(Object.entries(row.content).reverse()) })).toBe(true);
      expect(validate({ ...row, revision: 2 })).toBe(false);
      expect(validate({ ...row, content: { ...row.content, title: 'Other' } })).toBe(false);
      expect(validate({ ...row, ready: false })).toBe(false);
      return row;
    });
    await saveCommerceTranslation(target, mutation);
  });
  it('allows absent translation only on read', async () => {
    runtime.transport.mockImplementation(async (_endpoint, validate: (value: unknown) => boolean) => { expect(validate(null)).toBe(true); return null; });
    expect(await readCommerceTranslation(target)).toBeNull();
  });
});
describe('ERP translation route authorization and forwarding', () => {
  const params = Promise.resolve({ id, locale: 'vi' });
  const request = () => new Request('https://erp.test', { method: 'PATCH', body: JSON.stringify(mutation) });
  it('denies before body parsing or signed remote requests', async () => {
    runtime.access.mockRejectedValue(new Error('denied')); const input = request(); const json = vi.spyOn(input, 'json');
    expect((await handleErpTranslationRoute(input, params, true)).status).toBe(403);
    expect(json).not.toHaveBeenCalled(); expect(runtime.transport).not.toHaveBeenCalled();
  });
  it('rejects invalid locale and malformed payload', async () => {
    runtime.access.mockResolvedValue({});
    expect((await handleErpTranslationRoute(request(), Promise.resolve({ id, locale: 'fr' }), true)).status).toBe(400);
    expect((await handleErpTranslationRoute(new Request('https://erp.test', { method: 'PATCH', body: '{' }), params, true)).status).toBe(400);
    expect(runtime.transport).not.toHaveBeenCalled();
  });
  it('routes a draft with retained operation ID through write capability', async () => {
    runtime.access.mockResolvedValue({}); runtime.transport.mockResolvedValue(row);
    expect((await handleErpTranslationRoute(request(), params, true)).status).toBe(200);
    expect(runtime.access).toHaveBeenCalledWith('COMMERCE_PRODUCT_MANAGE');
    expect(runtime.transport.mock.calls[0][0].body).toEqual(mutation);
  });
});

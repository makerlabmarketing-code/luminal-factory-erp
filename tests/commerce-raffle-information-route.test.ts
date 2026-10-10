import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ access: vi.fn(), update: vi.fn() }));
vi.mock('@/services/server/commerceAdminRaffleAccess', () => ({ requireCommerceRaffleAccess: mocks.access }));
vi.mock('@/services/server/commerceAdminRaffles', () => ({ updateCommerceRaffleInformation: mocks.update }));
vi.mock('@/lib/commerce-admin/raffle-input', () => import('../lib/commerce-admin/raffle-input'));
vi.mock('@/lib/commerce-admin/raffle-draft', () => import('../lib/commerce-admin/raffle-draft'));
vi.mock('@/services/server/commerceAdminRouteResponse', () => ({
  commerceAdminJson: (body: unknown, init?: ResponseInit) => Response.json(body, { ...init, headers: { 'Cache-Control': 'no-store' } }),
  commerceAdminRouteError: () => Response.json({ success: false }, { status: 403 }),
}));
import { PATCH } from '../app/api/admin/commerce/raffles/[id]/route';
const id = '550e8400-e29b-41d4-a716-446655440000';
const mutation = { operationId: id, information: { title: 'Comeback', summary: null, rulesSummary: null, opensAt: '2026-10-10T05:00:00Z', closesAt: '2026-10-12T05:00:00Z' } };
const url = `https://erp.example/api/admin/commerce/raffles/${id}`;
function request(body: string, origin = 'https://erp.example') {
  return new Request(url, { method: 'PATCH', headers: { Origin: origin, 'Content-Type': 'application/json' }, body });
}
const params = { params: Promise.resolve({ id }) };
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({}); mocks.update.mockResolvedValue({ id }); });
describe('raffle information API', () => {
  it('rejects cross-origin requests before writing', async () => {
    expect((await PATCH(request(JSON.stringify(mutation), 'https://other.example'), params)).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('rejects an oversized UTF-8 body', async () => {
    expect((await PATCH(request(JSON.stringify({ ...mutation, padding: '字'.repeat(22_000) })), params)).status).toBe(413);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('rejects malformed JSON and client-supplied publication fields', async () => {
    expect((await PATCH(request('{'), params)).status).toBe(400);
    expect((await PATCH(request(JSON.stringify({ ...mutation, information: { ...mutation.information, isPublished: true } })), params)).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('passes valid data through the protected service and disables caching', async () => {
    const response = await PATCH(request(JSON.stringify(mutation)), params);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.access).toHaveBeenCalledWith('COMMERCE_RAFFLE_MANAGE');
    expect(mocks.update).toHaveBeenCalledWith(id, mutation);
  });
});

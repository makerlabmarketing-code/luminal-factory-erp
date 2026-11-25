import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { raffleSuggestedCloseInput } from '../lib/commerce-admin/raffle-draft';
import { raffleFulfillmentDueInput } from '../lib/commerce-admin/raffle-operations';

const mocks = vi.hoisted(() => ({
  access: vi.fn(), permission: vi.fn(), request: vi.fn(), raffle: vi.fn(), entries: vi.fn(),
}));
vi.mock('@/services/server/commerceAdminRaffleAccess', () => ({ requireCommerceRaffleAccess: mocks.access }));
vi.mock('@/services/server/auth', () => ({ hasPermission: mocks.permission }));
vi.mock('@/services/server/commerceAdminIntegration', () => ({ requestCommerceAdmin: mocks.request }));
vi.mock('@/services/server/commerceAdminRaffles', () => ({ getCommerceRaffle: mocks.raffle, listCommerceRaffleEntries: mocks.entries }));
vi.mock('@/services/server/commerceAdminRouteResponse', () => ({
  commerceAdminJson: (body: unknown, init?: ResponseInit) => Response.json(body, { ...init, headers: { 'Cache-Control': 'no-store' } }),
  commerceAdminRouteError: () => Response.json({ success: false }, { status: 403 }),
}));
vi.mock('@/lib/commerce-admin/raffle-input', () => import('../lib/commerce-admin/raffle-input'));
vi.mock('@/lib/commerce-admin/raffle-operations', () => import('../lib/commerce-admin/raffle-operations'));

import { GET, POST } from '../app/api/admin/commerce/raffles/[id]/operations/route';

const id = '550e8400-e29b-41d4-a716-446655440000';
const allocationId = '550e8400-e29b-41d4-a716-446655440001';
const entryId = '550e8400-e29b-41d4-a716-446655440002';
const operationId = '550e8400-e29b-41d4-a716-446655440003';
const origin = 'https://erp.example';
const url = origin + '/api/admin/commerce/raffles/' + id + '/operations';
const params = { params: Promise.resolve({ id }) };
const winner = { id: allocationId, raffle_id: id, raffle_entry_id: entryId, public_code: 'EXAMPLE123',
  status: 'SELECTED', paid_at: null, payment_deadline_at: null, fulfillment_due_at: null };
const payment = { action: 'confirm-payment', operationId, allocationId, paymentReference: 'BANK-123', verified: true };

function post(body: unknown, requestOrigin = origin) {
  return POST(new Request(url, { method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body) }), params);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('ERP_COMMERCE_RAFFLE_OPERATIONS_ENABLED', 'true');
  mocks.access.mockResolvedValue({});
  mocks.permission.mockResolvedValue(true);
  mocks.raffle.mockResolvedValue({ status: 'CLOSED', closes_at: '2026-01-01T00:00:00Z', product_id: id });
  mocks.entries.mockResolvedValue([{ id: entryId, shipping: { country_code: 'VN', address_line_1: 'private' } }]);
  mocks.request.mockImplementation(async (endpoint, guard) => {
    const statuses: Record<string, string> = { 'confirm-payment': 'PAID', fulfillment: 'FULFILLING', complete: 'COMPLETED' };
    const data = { allocation: { ...winner, status: statuses[endpoint.path.split('/').at(-1)] ?? 'SELECTED' } };
    if (!guard(data)) throw new Error('Response contract mismatch');
    return data;
  });
});
afterEach(() => vi.unstubAllEnvs());

describe('ERP raffle operations', () => {
  it('keeps both reads and mutations disabled by default', async () => {
    vi.stubEnv('ERP_COMMERCE_RAFFLE_OPERATIONS_ENABLED', '');
    expect((await GET(new Request(url), params)).status).toBe(404);
    expect((await post(payment)).status).toBe(404);
    expect(mocks.access).not.toHaveBeenCalled();
  });

  it('declines foreign origins and any request without access or payment verification', async () => {
    expect((await post(payment, 'https://unrelated.example')).status).toBe(403);
    expect((await post({ ...payment, verified: false })).status).toBe(400);
    expect((await post({ ...payment, scope: 'forged' })).status).toBe(400);
    mocks.permission.mockResolvedValueOnce(false);
    expect((await post(payment)).status).toBe(403);
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it('sends only the verified reference and stable operation identifier on the dedicated payment scope', async () => {
    expect((await post(payment)).status).toBe(200);
    expect((await post(payment)).status).toBe(200);
    expect(mocks.permission).toHaveBeenCalledWith({}, 'COMMERCE_RAFFLE_PAYMENT_CONFIRM');
    expect(mocks.request.mock.calls.map(([endpoint]) => endpoint)).toEqual(Array(2).fill({
      capability: 'COMMERCE_RAFFLE_PAYMENT_CONFIRM', scope: 'commerce.raffle.payment.manage', method: 'POST',
      path: `/api/admin/v1/raffles/${id}/winner-allocations/${allocationId}/confirm-payment`,
      body: { operationId, paymentReference: 'BANK-123' },
    }));
  });

  it('requires a closed and configured raffle and an eligible entry before recording a winner', async () => {
    const select = { action: 'select', operationId, entryId };
    mocks.raffle.mockResolvedValueOnce({ status: 'OPEN', closes_at: '2099-01-01T00:00:00Z', product_id: id });
    expect((await post(select)).status).toBe(409);
    mocks.entries.mockResolvedValueOnce([{ id: entryId, shipping: null }]);
    expect((await post(select)).status).toBe(409);
    expect(mocks.request).not.toHaveBeenCalled();
    expect((await post(select)).status).toBe(200);
    expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'commerce.raffle.winner.manage', body: { operationId, entryId },
    }), expect.any(Function));
  });

  it('filters allocated entries and removes shipping addresses and payment data from the workspace response', async () => {
    const another = '550e8400-e29b-41d4-a716-446655440004';
    mocks.entries.mockResolvedValueOnce([
      { id: entryId, display_name: 'Current', shipping: { country_code: 'VN' } },
      { id: another, display_name: 'Candidate', contact_email: 'qa@example.test',
        shipping: { country_code: 'VN', address_line_1: 'private address' } },
    ]);
    mocks.request.mockResolvedValueOnce([{ ...winner, order_id: id, reference: 'private payment' }]);
    const response = await GET(new Request(url), params);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ success: true, allocations: [winner], canSelect: true, canConfirmPayment: true,
      canFulfill: true, candidates: [{ id: another, name: 'Candidate', email: 'qa@example.test', country: 'VN' }] });
  });

  it('requires fulfillment permission for dispatch notes and returns only the scoped note and timestamp', async () => {
    const trackingUrl = url + '?tracking=' + allocationId;
    mocks.permission.mockResolvedValueOnce(false);
    expect((await GET(new Request(trackingUrl), params)).status).toBe(403);
    expect(mocks.request).not.toHaveBeenCalled();
    expect((await GET(new Request(url + '?tracking=invalid'), params)).status).toBe(400);

    const tracking = { note: 'Carrier / TRACK-123', completedAt: '2026-11-25T03:00:00Z' };
    mocks.request.mockImplementationOnce(async (_endpoint, guard) => {
      const result = { tracking: { ...tracking, actor_id: 'private' } };
      expect(guard(result)).toBe(true);
      return result;
    });
    const response = await GET(new Request(trackingUrl), params);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ success: true, tracking });
    expect(mocks.request).toHaveBeenCalledWith({
      capability: 'COMMERCE_RAFFLE_FULFILLMENT_MANAGE', scope: 'commerce.raffle.fulfillment.manage', method: 'GET',
      path: `/api/admin/v1/raffles/${id}/winner-allocations/${allocationId}/complete`,
    }, expect.any(Function));
    expect(mocks.entries).not.toHaveBeenCalled();
  });

  it.each([
    ['fulfillment', { fulfillmentDue: '2026-02-28T12:15' }, { fulfillmentDueAt: '2026-02-28T05:15:00.000Z' }],
    ['complete', { note: 'Carrier / Tracking' }, { note: 'Carrier / Tracking' }],
  ])('uses fulfillment permissions for %s', async (action, additionalFields, expectedBody) => {
    expect((await post({ action, operationId, allocationId, ...additionalFields })).status).toBe(200);
    expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({
      capability: 'COMMERCE_RAFFLE_FULFILLMENT_MANAGE', scope: 'commerce.raffle.fulfillment.manage',
      body: { operationId, ...expectedBody },
    }), expect.any(Function));
  });
});

describe('Vietnam time for raffle operations', () => {
  it('suggests seven days from opening and clamps one calendar month after payment to the final day of February', () => {
    expect(raffleSuggestedCloseInput('2026-12-31T22:30')).toBe('2027-01-07T22:30:00');
    expect(raffleSuggestedCloseInput('invalid')).toBe('');
    expect(raffleFulfillmentDueInput('2026-01-31T05:15:00Z')).toBe('2026-02-28T12:15:00');
    expect(raffleFulfillmentDueInput('2028-01-30T21:30:00Z')).toBe('2028-02-29T04:30:00');
  });
});

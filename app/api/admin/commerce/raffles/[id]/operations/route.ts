import { isRaffleUuid } from '@/lib/commerce-admin/raffle-input';
import { allocationSummary, canRecordRaffleWinner, isRaffleAllocation, parseRaffleOperationsInput,
  raffleActions, type RaffleAllocation } from '@/lib/commerce-admin/raffle-operations';
import { requestCommerceAdmin } from '@/services/server/commerceAdminIntegration';
import { requireCommerceRaffleAccess } from '@/services/server/commerceAdminRaffleAccess';
import { getCommerceRaffle, listCommerceRaffleEntries } from '@/services/server/commerceAdminRaffles';
import { commerceAdminJson, commerceAdminRouteError } from '@/services/server/commerceAdminRouteResponse';
import { hasPermission } from '@/services/server/auth';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };

function failure(status: number, message: string) {
  return commerceAdminJson({ success: false, message }, { status });
}

export async function GET(_request: Request, { params }: Props) {
  if (process.env.ERP_COMMERCE_RAFFLE_OPERATIONS_ENABLED !== 'true') return failure(404, 'Trang vận hành chưa được bật.');
  try {
    const actor = await requireCommerceRaffleAccess('COMMERCE_RAFFLE_MANAGE');
    const { id } = await params;
    if (!isRaffleUuid(id)) return failure(400, 'Mã đợt raffle không hợp lệ.');
    const [raffle, allocations, canReadEntries, canConfirmPayment, canFulfill] = await Promise.all([
      getCommerceRaffle(id),
      requestCommerceAdmin({
        capability: 'COMMERCE_RAFFLE_MANAGE', scope: 'commerce.raffle.winner.manage', method: 'GET',
        path: `/api/admin/v1/raffles/${id}/winner-allocations`,
      }, (value): value is RaffleAllocation[] => Array.isArray(value) && value.length <= 200
        && value.every(allocation => isRaffleAllocation(allocation) && allocation.raffle_id === id)),
      hasPermission(actor, 'COMMERCE_RAFFLE_ENTRY_VIEW'),
      hasPermission(actor, 'COMMERCE_RAFFLE_PAYMENT_CONFIRM'),
      hasPermission(actor, 'COMMERCE_RAFFLE_FULFILLMENT_MANAGE'),
    ]);
    const canSelect = canReadEntries && allocations.length < 200 && canRecordRaffleWinner(raffle, Date.now());
    const allocatedEntries = new Set(allocations.map(allocation => allocation.raffle_entry_id));
    const candidates = canSelect
      ? (await listCommerceRaffleEntries(id)).filter(entry => entry.shipping && !allocatedEntries.has(entry.id))
        .map(entry => ({ id: entry.id, name: entry.display_name, email: entry.contact_email, country: entry.shipping?.country_code }))
      : [];

    return commerceAdminJson({ success: true, allocations: allocations.map(allocationSummary),
      candidates, canSelect, canConfirmPayment, canFulfill });
  } catch (error) { return commerceAdminRouteError(error, 'Không thể tải vận hành raffle.'); }
}

export async function POST(request: Request, { params }: Props) {
  if (process.env.ERP_COMMERCE_RAFFLE_OPERATIONS_ENABLED !== 'true') return failure(404, 'Trang vận hành chưa được bật.');
  try {
    const actor = await requireCommerceRaffleAccess('COMMERCE_RAFFLE_MANAGE');
    if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
      return failure(403, 'Nguồn yêu cầu không hợp lệ.');
    }
    if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
      return failure(415, 'Định dạng yêu cầu không hợp lệ.');
    }
    const { id } = await params;
    if (Number(request.headers.get('content-length')) > 4096) return failure(413, 'Yêu cầu vượt dung lượng cho phép.');
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > 4096) return failure(413, 'Yêu cầu vượt dung lượng cho phép.');
    let input: unknown;
    try { input = JSON.parse(raw); } catch { return failure(400, 'Nội dung yêu cầu không hợp lệ.'); }
    const mutation = parseRaffleOperationsInput(input);
    if (!isRaffleUuid(id) || !mutation) return failure(400, 'Kiểm tra thông tin thao tác raffle.');
    const { action, allocationId, body } = mutation;
    const { capability, scope, outcome } = raffleActions[action];
    if (capability !== 'COMMERCE_RAFFLE_MANAGE' && !(await hasPermission(actor, capability))) {
      return failure(403, 'Bạn chưa có quyền thực hiện thao tác này.');
    }
    if (action === 'select' || action === 'reallocate') {
      if (!(await hasPermission(actor, 'COMMERCE_RAFFLE_ENTRY_VIEW'))) return failure(403, 'Bạn chưa có quyền xem người tham gia.');
      if (!canRecordRaffleWinner(await getCommerceRaffle(id), Date.now())) return failure(409, 'Cần gắn sản phẩm và đóng đợt raffle trước khi ghi nhận người trúng.');
      const entryId = action === 'select' ? body.entryId : body.replacementEntryId;
      if (!(await listCommerceRaffleEntries(id)).some(entry => entry.id === entryId && entry.shipping)) {
        return failure(409, 'Người tham gia chưa có địa chỉ giao hàng hợp lệ.');
      }
    }
    const basePath = `/api/admin/v1/raffles/${id}/winner-allocations`;
    const path = allocationId ? `${basePath}/${allocationId}/${action}` : basePath;
    await requestCommerceAdmin({ capability, scope, method: 'POST', path, body },
      (value): value is { allocation: RaffleAllocation } =>
        !!value && typeof value === 'object' && 'allocation' in value
        && isRaffleAllocation(value.allocation) && value.allocation.raffle_id === id && value.allocation.status === outcome
        && (action === 'reallocate' || allocationId === null || value.allocation.id === allocationId));
    return commerceAdminJson({ success: true });
  } catch (error) { return commerceAdminRouteError(error, 'Không thể cập nhật vận hành raffle.'); }
}

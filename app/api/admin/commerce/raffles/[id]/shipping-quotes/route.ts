import { isRaffleUuid } from '@/lib/commerce-admin/raffle-input';
import { isRaffleShippingRateInput } from '@/lib/commerce-admin/raffle-shipping';
import { requestCommerceAdmin } from '@/services/server/commerceAdminIntegration';
import { requireCommerceRaffleAccess } from '@/services/server/commerceAdminRaffleAccess';
import { commerceAdminJson, commerceAdminRouteError } from '@/services/server/commerceAdminRouteResponse';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };
const permission = 'COMMERCE_RAFFLE_MANAGE';
const scope = 'commerce.raffle.winner.manage';

type Winner = { id: string; public_code: string; status: string };
type Quote = { to: string; subject: string; text: string };

function isWinner(value: unknown): value is Winner {
  if (!value || typeof value !== 'object') return false;
  const winner = value as Partial<Winner>;
  return typeof winner.id === 'string' && isRaffleUuid(winner.id)
    && typeof winner.public_code === 'string' && typeof winner.status === 'string';
}

function isQuote(value: unknown): value is Quote {
  if (!value || typeof value !== 'object') return false;
  const quote = value as Partial<Quote>;
  return typeof quote.to === 'string' && /^[^\s,;:<>@]+@[^\s,;:<>@]+$/.test(quote.to)
    && typeof quote.subject === 'string' && typeof quote.text === 'string';
}

const invalid = () => commerceAdminJson({ success: false, message: 'Thông tin báo giá không hợp lệ.' }, { status: 400 });

export async function GET(request: Request, { params }: Props) {
  try {
    await requireCommerceRaffleAccess(permission);
    const { id } = await params;
    const allocationId = new URL(request.url).searchParams.get('allocation');
    if (!isRaffleUuid(id) || (allocationId !== null && !isRaffleUuid(allocationId))) return invalid();
    const path = `/api/admin/v1/raffles/${id}/winner-allocations`;
    if (allocationId) {
      const quote = await requestCommerceAdmin({ capability: permission, scope, method: 'GET', path: `${path}/${allocationId}/confirm` }, isQuote);
      return commerceAdminJson({ success: true, quote });
    }
    const winners = await requestCommerceAdmin({ capability: permission, scope, method: 'GET', path },
      (value): value is Winner[] => Array.isArray(value) && value.every(isWinner));
    return commerceAdminJson({ success: true, winners: winners
      .filter(winner => winner.status === 'SELECTED' || winner.status === 'PAYMENT_PENDING')
      .map(({ id, public_code, status }) => ({ id, public_code, status })) });
  } catch (error) { return commerceAdminRouteError(error, 'Không thể tải báo giá raffle.'); }
}

export async function POST(request: Request, { params }: Props) {
  try {
    await requireCommerceRaffleAccess(permission);
    const url = new URL(request.url);
    if (request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') {
      return commerceAdminJson({ success: false, message: 'Nguồn yêu cầu không hợp lệ.' }, { status: 403 });
    }
    if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
      return commerceAdminJson({ success: false, message: 'Định dạng yêu cầu không hợp lệ.' }, { status: 415 });
    }
    const { id } = await params;
    const value = await request.json().catch(() => null);
    if (!isRaffleUuid(id) || !value || typeof value.allocationId !== 'string' || !isRaffleUuid(value.allocationId)
      || typeof value.operationId !== 'string' || !isRaffleUuid(value.operationId)
      || typeof value.paymentDeadlineAt !== 'string' || !Number.isFinite(Date.parse(value.paymentDeadlineAt))) return invalid();
    const { allocationId, operationId, paymentDeadlineAt, override } = value;
    if (override !== undefined && !isRaffleShippingRateInput({
      country_code: 'US', carrier_minor: override?.carrierMinor, covered_minor: override?.coveredMinor,
    })) return invalid();
    const path = `/api/admin/v1/raffles/${id}/winner-allocations/${allocationId}/confirm`;
    await requestCommerceAdmin({
      capability: permission, scope, method: 'POST', path,
      body: { operationId, paymentDeadlineAt, useShippingRates: true, override },
    }, (value): value is { order: object } => !!value && typeof value === 'object' && 'order' in value && !!value.order);
    const quote = await requestCommerceAdmin({ capability: permission, scope, method: 'GET', path }, isQuote);
    return commerceAdminJson({ success: true, quote });
  } catch (error) { return commerceAdminRouteError(error, 'Không thể xác nhận báo giá raffle. Kiểm tra phí tuyến và hạn thanh toán.'); }
}

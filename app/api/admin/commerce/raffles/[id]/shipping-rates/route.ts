import { isRaffleUuid } from '@/lib/commerce-admin/raffle-input';
import { isRaffleShippingRate, isRaffleShippingRateInput, type RaffleShippingRate } from '@/lib/commerce-admin/raffle-shipping';
import { requestCommerceAdmin } from '@/services/server/commerceAdminIntegration';
import { requireCommerceRaffleAccess } from '@/services/server/commerceAdminRaffleAccess';
import { commerceAdminJson, commerceAdminRouteError } from '@/services/server/commerceAdminRouteResponse';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  try {
    const { id } = await params;
    if (!isRaffleUuid(id)) return commerceAdminJson({ success: false, message: 'Mã raffle không hợp lệ.' }, { status: 400 });
    const rates = await requestCommerceAdmin({
      capability: 'COMMERCE_RAFFLE_VIEW', scope: 'commerce.raffle.read', method: 'GET',
      path: `/api/admin/v1/raffles/${id}/shipping-rates`,
    }, (value): value is RaffleShippingRate[] => Array.isArray(value) && value.every(isRaffleShippingRate));
    return commerceAdminJson({ success: true, rates });
  } catch (error) { return commerceAdminRouteError(error, 'Không thể tải bảng phí giao hàng.'); }
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    await requireCommerceRaffleAccess('COMMERCE_RAFFLE_MANAGE');
    if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
      return commerceAdminJson({ success: false, message: 'Nguồn yêu cầu không hợp lệ.' }, { status: 403 });
    }
    const { id } = await params;
    if (!isRaffleUuid(id)) return commerceAdminJson({ success: false, message: 'Mã raffle không hợp lệ.' }, { status: 400 });
    if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
      return commerceAdminJson({ success: false, message: 'Định dạng yêu cầu không hợp lệ.' }, { status: 415 });
    }
    const value: unknown = await request.json().catch(() => null);
    if (!isRaffleShippingRateInput(value)) return commerceAdminJson({ success: false, message: 'Phí hoặc mã quốc gia không hợp lệ.' }, { status: 400 });
    const { country_code, carrier_minor, covered_minor } = value;
    const rate = await requestCommerceAdmin({
      capability: 'COMMERCE_RAFFLE_MANAGE', scope: 'commerce.raffle.write', method: 'PATCH',
      path: `/api/admin/v1/raffles/${id}/shipping-rates`, body: { country_code, carrier_minor, covered_minor },
    }, (value): value is RaffleShippingRate => isRaffleShippingRate(value) && value.country_code === country_code);
    return commerceAdminJson({ success: true, rate });
  } catch (error) { return commerceAdminRouteError(error, 'Không thể lưu phí giao hàng.'); }
}

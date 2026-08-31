import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { getProductionOrderDetail } from '@/services/server/productionOrders';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(_request: Request, { params }: { params: Promise<{ productionOrderId: string }> }) {
  const { productionOrderId } = await params;
  if (!UUID_PATTERN.test(productionOrderId)) {
    return jsonNoStore({ success: false, message: 'Mã lệnh sản xuất không hợp lệ.' }, { status: 422 });
  }

  try {
    return jsonNoStore({ success: true, order: await getProductionOrderDetail(productionOrderId) });
  } catch (error) {
    if (error instanceof AuthFlowError) {
      return jsonNoStore({ success: false, message: error.message, code: error.code }, { status: error.status });
    }
    return jsonNoStore({ success: false, message: 'Không thể tải chi tiết lệnh sản xuất.' }, { status: 500 });
  }
}

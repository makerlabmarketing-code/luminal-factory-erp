import { NextRequest, NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { getProductionOrderList } from '@/services/server/productionOrders';
import { createProductionOrder } from '@/services/server/productionOrderMutations';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET() {
  try {
    return jsonNoStore({
      success: true,
      ...await getProductionOrderList(),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AuthFlowError) {
      return jsonNoStore({ success: false, message: error.message, code: error.code }, { status: error.status });
    }
    return jsonNoStore({ success: false, message: 'Không thể tải lệnh sản xuất.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonNoStore({ success: false, message: 'Dữ liệu tạo lệnh sản xuất không hợp lệ.' }, { status: 422 });
    }
    return jsonNoStore(await createProductionOrder(body as Record<string, unknown>), { status: 201 });
  } catch (error) {
    if (error instanceof AuthFlowError) {
      return jsonNoStore({ success: false, message: error.message, code: error.code }, { status: error.status });
    }
    return jsonNoStore({ success: false, message: 'Không thể tạo lệnh sản xuất.' }, { status: 500 });
  }
}

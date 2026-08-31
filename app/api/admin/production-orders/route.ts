import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { getProductionOrders } from '@/services/server/productionOrders';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET() {
  try {
    return jsonNoStore({
      success: true,
      orders: await getProductionOrders(),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AuthFlowError) {
      return jsonNoStore({ success: false, message: error.message, code: error.code }, { status: error.status });
    }
    return jsonNoStore({ success: false, message: 'Không thể tải lệnh sản xuất.' }, { status: 500 });
  }
}

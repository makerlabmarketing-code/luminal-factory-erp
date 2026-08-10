import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { transitionReimbursement } from '@/services/server/financeReimbursements';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(request: Request) {
  try {
    return jsonNoStore(await transitionReimbursement(await request.json() as Record<string, unknown>));
  } catch (error) {
    return jsonNoStore(
      {
        success: false,
        message: error instanceof AuthFlowError ? error.message : 'Không thể cập nhật hoàn ứng.',
      },
      { status: error instanceof AuthFlowError ? error.status : 500 },
    );
  }
}

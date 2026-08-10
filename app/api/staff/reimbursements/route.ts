import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { listOwnReimbursements, submitOwnReimbursement } from '@/services/server/financeReimbursements';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function failure(error: unknown) {
  return jsonNoStore(
    {
      success: false,
      message: error instanceof AuthFlowError ? error.message : 'Không thể xử lý yêu cầu hoàn ứng.',
    },
    { status: error instanceof AuthFlowError ? error.status : 500 },
  );
}

export async function GET() {
  try {
    return jsonNoStore(await listOwnReimbursements());
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    return jsonNoStore(await submitOwnReimbursement(await request.json() as Record<string, unknown>));
  } catch (error) {
    return failure(error);
  }
}

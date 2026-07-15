import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { revokeAccountAccess } from '@/services/server/adminAccountManagement';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');

  return response;
}

function toErrorResponse(error: unknown) {
  if (error instanceof AuthFlowError) {
    return jsonNoStore({ success: false, message: error.message }, { status: error.status });
  }

  return jsonNoStore(
    { success: false, message: 'Không thể thu hồi quyền truy cập.' },
    { status: 500 }
  );
}

export async function POST(
  _request: Request,
  { params }: { params: { employeeId: string } }
) {
  try {
    return jsonNoStore(await revokeAccountAccess(params.employeeId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

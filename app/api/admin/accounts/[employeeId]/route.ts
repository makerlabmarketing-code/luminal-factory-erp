import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { getAdminAccountDetailData } from '@/services/server/adminAccountManagement';

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
    { success: false, message: 'Không thể tải chi tiết tài khoản.' },
    { status: 500 }
  );
}

export async function GET(
  _request: Request,
  { params }: { params: { employeeId: string } }
) {
  try {
    return jsonNoStore(await getAdminAccountDetailData(params.employeeId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

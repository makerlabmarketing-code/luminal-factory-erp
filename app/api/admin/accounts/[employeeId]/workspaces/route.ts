import { NextRequest, NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { updateAccountWorkspaces } from '@/services/server/adminAccountManagement';

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
    { success: false, message: 'Không thể cập nhật workspace.' },
    { status: 500 }
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { employeeId: string } }
) {
  try {
    const body = (await request.json().catch(() => null)) || {};
    return jsonNoStore(await updateAccountWorkspaces(params.employeeId, body));
  } catch (error) {
    return toErrorResponse(error);
  }
}

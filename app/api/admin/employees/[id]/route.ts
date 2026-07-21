import { NextRequest, NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { updateEmployee } from '@/services/server/adminEmployeeActions';

function toJsonResponse(result: unknown, init?: ResponseInit) {
  const response = NextResponse.json(result, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function toErrorResponse(error: unknown) {
  if (error instanceof AuthFlowError) {
    return toJsonResponse(
      { success: false, message: error.message, code: error.code, failureStage: error.failureStage },
      { status: error.status }
    );
  }

  return toJsonResponse(
    { success: false, message: 'Không thể xử lý hồ sơ nhân sự.', code: 'employee_unhandled_failure', failureStage: 'unknown' },
    { status: 500 }
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await request.json().catch(() => null)) || {};
    return toJsonResponse(await updateEmployee(params.id, body));
  } catch (error) {
    return toErrorResponse(error);
  }
}

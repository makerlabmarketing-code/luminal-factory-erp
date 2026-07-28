import { NextRequest, NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { updateEmployee } from '@/services/server/adminEmployeeActions';

function toJsonResponse(result: unknown, init?: ResponseInit) {
  const response = NextResponse.json(result, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function logEmployeeRouteError(correlationId: string, error: unknown) {
  const safeError = error instanceof AuthFlowError
    ? { code: error.code, failureStage: error.failureStage, status: error.status }
    : { code: 'employee_update_failed', failureStage: 'unknown', message: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240) };

  console.error('[employee-route]', { correlationId, error: safeError });
}

function toErrorResponse(error: unknown) {
  const correlationId = crypto.randomUUID();
  logEmployeeRouteError(correlationId, error);
  if (error instanceof AuthFlowError) {
    return toJsonResponse(
      { success: false, message: error.message, code: error.code, failureStage: error.failureStage, correlationId },
      { status: error.status }
    );
  }

  return toJsonResponse(
    { success: false, message: 'Không thể cập nhật hồ sơ nhân sự. Vui lòng thử lại.', code: 'employee_update_failed', failureStage: 'unknown', correlationId },
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

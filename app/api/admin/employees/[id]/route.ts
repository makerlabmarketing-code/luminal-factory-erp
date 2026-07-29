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
    ? { code: error.code, failureStage: error.failureStage, status: error.status, ...error.safeDetails }
    : { code: 'employee_update_failed', failureStage: 'persistence', errorType: error instanceof Error ? error.name : 'unknown' };

  console.error('[employee-route]', { correlationId, error: safeError });
}

function toErrorResponse(correlationId: string, error: unknown) {
  logEmployeeRouteError(correlationId, error);
  if (error instanceof AuthFlowError) {
    return toJsonResponse(
      { success: false, message: error.message, code: error.code, failureStage: error.failureStage, correlationId },
      { status: error.status }
    );
  }

  return toJsonResponse(
    { success: false, message: 'Không thể cập nhật hồ sơ nhân sự. Vui lòng thử lại.', code: 'employee_update_failed', failureStage: 'persistence', correlationId },
    { status: 500 }
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const body = (await request.json().catch(() => null)) || {};
    const result = await updateEmployee(params.id, body);
    console.info('[employee-route]', {
      correlationId,
      code: result.code || 'employee_updated',
      failureStage: result.failureStage || 'persisted',
    });
    return toJsonResponse({ ...result, correlationId });
  } catch (error) {
    return toErrorResponse(correlationId, error);
  }
}

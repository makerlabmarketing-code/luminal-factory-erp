import { NextRequest, NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { createEmployee } from '@/services/server/adminEmployeeActions';
import { getAdminEmployeeListData } from '@/services/server/adminEmployeeData';
import { sanitizeAdminMutationFailure } from '@/services/server/adminEmployeePersistence';

function toJsonResponse(result: unknown, init?: ResponseInit) {
  const response = NextResponse.json(result, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function logEmployeeRouteError(correlationId: string, error: unknown) {
  const safeError = error instanceof AuthFlowError
    ? { code: error.code, failureStage: error.failureStage, status: error.status }
    : { code: 'employee_update_failed', failureStage: 'unknown', ...sanitizeAdminMutationFailure(error) };

  console.error('[employee-route]', { correlationId, error: safeError });
}

function toErrorResponse(error: unknown, correlationId: string, operation: 'create' | 'update' = 'update') {
  logEmployeeRouteError(correlationId, error);
  if (error instanceof AuthFlowError) {
    return toJsonResponse(
      {
        success: false,
        message: error.message,
        code: error.code,
        failureStage: error.failureStage,
        fieldErrors: error.fieldErrors,
        diagnosticAvailable: Boolean(error.diagnosticAvailable),
        correlationId,
      },
      { status: error.status }
    );
  }

  return toJsonResponse(
    { success: false, message: operation === 'create' ? 'Không thể lưu hồ sơ nhân sự. Vui lòng thử lại.' : 'Không thể cập nhật hồ sơ nhân sự. Vui lòng thử lại.', code: operation === 'create' ? 'employee_persistence_failed' : 'employee_update_failed', failureStage: 'unknown', correlationId },
    { status: 500 }
  );
}

export async function GET() {
  try {
    return toJsonResponse(await getAdminEmployeeListData());
  } catch (error) {
    const correlationId = crypto.randomUUID();
    if (error instanceof AuthFlowError && error.status === 403) {
      return toJsonResponse({ success: false, code: 'forbidden', message: 'Bạn không có quyền xem danh sách nhân sự.', failureStage: error.failureStage, retryable: false, correlationId }, { status: 403 });
    }
    return toJsonResponse({ success: false, code: 'employee_list_load_failed', message: 'Không thể tải danh sách nhân sự.', failureStage: error instanceof AuthFlowError ? error.failureStage : 'unknown', retryable: true, correlationId }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const body = (await request.json().catch(() => null)) || {};
    return toJsonResponse(await createEmployee(body, correlationId));
  } catch (error) {
    return toErrorResponse(error, correlationId, 'create');
  }
}

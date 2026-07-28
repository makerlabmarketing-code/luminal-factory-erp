import { NextRequest, NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { createEmployee } from '@/services/server/adminEmployeeActions';
import { getAdminEmployeeListData } from '@/services/server/adminEmployeeData';

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
  try {
    const body = (await request.json().catch(() => null)) || {};
    return toJsonResponse(await createEmployee(body));
  } catch (error) {
    return toErrorResponse(error);
  }
}

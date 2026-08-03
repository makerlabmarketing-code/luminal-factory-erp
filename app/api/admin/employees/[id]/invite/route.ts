import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { inviteEmployee } from '@/services/server/adminEmployeeActions';

function toJsonResponse(result: unknown, init?: ResponseInit) {
  const response = NextResponse.json(result, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function toErrorResponse(error: unknown, correlationId: string) {
  if (error instanceof AuthFlowError) {
    return toJsonResponse({ success: false, code: error.code, message: error.message, correlationId }, { status: error.status });
  }

  return toJsonResponse(
    { success: false, code: 'employee_invitation_failed', message: 'Không thể gửi lời mời.', correlationId },
    { status: 500 }
  );
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    return toJsonResponse(await inviteEmployee(params.id, correlationId));
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}

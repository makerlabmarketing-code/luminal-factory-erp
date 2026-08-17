import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { revokeEmployeeAccess } from '@/services/server/adminEmployeeActions';

function toJsonResponse(result: unknown, init?: ResponseInit) {
  const response = NextResponse.json(result, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function toErrorResponse(error: unknown) {
  if (error instanceof AuthFlowError) {
    return toJsonResponse({ success: false, message: error.message }, { status: error.status });
  }

  return toJsonResponse(
    { success: false, message: 'Không thể thu hồi quyền truy cập.' },
    { status: 500 }
  );
}

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    return toJsonResponse(await revokeEmployeeAccess(params.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}

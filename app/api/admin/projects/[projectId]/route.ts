import { NextRequest, NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { updateProject } from '@/services/server/projectMutations';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');

  return response;
}

function toErrorResponse(error: unknown) {
  if (error instanceof AuthFlowError) {
    return jsonNoStore(
      {
        success: false,
        message: error.message,
        code: error.code,
        failure_stage: error.failureStage,
        supabase_error_code: error.safeDetails?.supabase_error_code ?? null,
      },
      { status: error.status }
    );
  }

  return jsonNoStore(
    {
      success: false,
      message: 'Không thể cập nhật dự án.',
      code: 'project_update_failed',
      failure_stage: 'unknown',
    },
    { status: 500 }
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const body = (await request.json().catch(() => null)) || {};
    return jsonNoStore(await updateProject(params.projectId, body));
  } catch (error) {
    return toErrorResponse(error);
  }
}

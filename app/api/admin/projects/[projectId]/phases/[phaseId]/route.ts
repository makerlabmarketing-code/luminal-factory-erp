import { NextRequest, NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { updatePhase } from '@/services/server/phaseMutations';

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
      },
      { status: error.status }
    );
  }

  return jsonNoStore(
    {
      success: false,
      message: 'Không thể lưu giai đoạn.',
      code: 'phase_update_failed',
      failure_stage: 'unknown',
    },
    { status: 500 }
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string; phaseId: string } }
) {
  try {
    const body = (await request.json().catch(() => null)) || {};
    return jsonNoStore(await updatePhase(params.projectId, params.phaseId, body));
  } catch (error) {
    return toErrorResponse(error);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { listPhases } from '@/services/server/phaseMutations';

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
      message: 'Không thể tải giai đoạn.',
      code: 'phase_load_failed',
      failure_stage: 'unknown',
    },
    { status: 500 }
  );
}

export async function POST(request: NextRequest) {
  const startedAt = performance.now();

  try {
    const body = (await request.json().catch(() => null)) || {};
    const result = await listPhases(body);
    console.info('[admin-phase-list-read]', {
      durationMs: Math.round(performance.now() - startedAt),
      projectCount: Array.isArray(body.projectIds) ? body.projectIds.length : 0,
      phaseCount: result.phases.length,
    });
    return jsonNoStore(result);
  } catch (error) {
    console.warn('[admin-phase-list-read]', {
      durationMs: Math.round(performance.now() - startedAt),
      outcome: 'failed',
      failureStage: error instanceof AuthFlowError ? error.failureStage : 'unknown',
    });
    return toErrorResponse(error);
  }
}

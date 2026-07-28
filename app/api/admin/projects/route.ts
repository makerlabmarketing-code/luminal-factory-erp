import { NextRequest, NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { createProject, getProjectCreationOptions } from '@/services/server/projectMutations';

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
      message: 'Không thể xử lý dự án.',
      code: 'project_mutation_failed',
      failure_stage: 'unknown',
    },
    { status: 500 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) || {};
    return jsonNoStore(await createProject(body), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function GET() {
  try {
    return jsonNoStore(await getProjectCreationOptions());
  } catch (error) {
    return toErrorResponse(error);
  }
}

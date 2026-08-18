import { NextRequest, NextResponse } from 'next/server';
import { changeProjectTaskStatus, taskAssignmentErrorResponse } from '@/services/server/taskAssignmentFoundation';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ projectId: string; taskId: string }> }
) {
  const params = await props.params;
  try {
    const body = (await request.json().catch(() => null)) || {};
    return jsonNoStore(await changeProjectTaskStatus(params.projectId, params.taskId, body));
  } catch (error) {
    const mapped = taskAssignmentErrorResponse(error);
    return jsonNoStore(mapped.body, { status: mapped.status });
  }
}

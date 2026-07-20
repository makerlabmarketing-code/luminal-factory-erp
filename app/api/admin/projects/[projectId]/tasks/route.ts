import { NextRequest, NextResponse } from 'next/server';
import { createProjectTask, listProjectTasks, taskAssignmentErrorResponse } from '@/services/server/taskAssignmentFoundation';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(_request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    return jsonNoStore(await listProjectTasks(params.projectId));
  } catch (error) {
    const mapped = taskAssignmentErrorResponse(error);
    return jsonNoStore(mapped.body, { status: mapped.status });
  }
}

export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const body = (await request.json().catch(() => null)) || {};
    return jsonNoStore(await createProjectTask(params.projectId, body), { status: 201 });
  } catch (error) {
    const mapped = taskAssignmentErrorResponse(error);
    return jsonNoStore(mapped.body, { status: mapped.status });
  }
}

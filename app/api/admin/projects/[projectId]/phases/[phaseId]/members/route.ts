import { NextRequest, NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { listPhaseMembers, setPhaseMembers } from '@/services/server/phaseMembers';

type Context = { params: Promise<{ projectId: string; phaseId: string }> };
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } }); }
function errorResponse(error: unknown) {
  return error instanceof AuthFlowError ? json({ message: error.message, code: error.code }, error.status) : json({ message: 'Không thể xử lý phân công giai đoạn.' }, 500);
}
export async function GET(_request: NextRequest, context: Context) {
  const { projectId, phaseId } = await context.params;
  try { return json(await listPhaseMembers(projectId, phaseId)); } catch (error) { return errorResponse(error); }
}
export async function PUT(request: NextRequest, context: Context) {
  const { projectId, phaseId } = await context.params;
  try { return json(await setPhaseMembers(projectId, phaseId, await request.json().catch(() => null))); } catch (error) { return errorResponse(error); }
}

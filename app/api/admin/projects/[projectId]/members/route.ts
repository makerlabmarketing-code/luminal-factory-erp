import { NextRequest, NextResponse } from 'next/server';
import { addProjectMember, listProjectMemberCandidates, listProjectMembers, projectMembershipErrorResponse } from '@/services/server/projectMembershipManagement';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    if (request.nextUrl.searchParams.get('scope') === 'candidates') {
      return jsonNoStore(await listProjectMemberCandidates(params.projectId));
    }
    return jsonNoStore(await listProjectMembers(params.projectId));
  } catch (error) {
    const mapped = projectMembershipErrorResponse(error);
    return jsonNoStore(mapped.body, { status: mapped.status });
  }
}

export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const body = (await request.json().catch(() => null)) || {};
    return jsonNoStore(await addProjectMember(params.projectId, body), { status: 201 });
  } catch (error) {
    const mapped = projectMembershipErrorResponse(error);
    return jsonNoStore(mapped.body, { status: mapped.status });
  }
}

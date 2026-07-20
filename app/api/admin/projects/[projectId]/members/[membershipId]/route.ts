import { NextRequest, NextResponse } from 'next/server';
import { projectMembershipErrorResponse, updateProjectMember } from '@/services/server/projectMembershipManagement';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function PATCH(request: NextRequest, { params }: { params: { projectId: string; membershipId: string } }) {
  try {
    const body = (await request.json().catch(() => null)) || {};
    return jsonNoStore(await updateProjectMember(params.projectId, params.membershipId, body));
  } catch (error) {
    const mapped = projectMembershipErrorResponse(error);
    return jsonNoStore(mapped.body, { status: mapped.status });
  }
}

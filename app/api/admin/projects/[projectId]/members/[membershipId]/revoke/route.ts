import { NextResponse } from 'next/server';
import { projectMembershipErrorResponse, revokeProjectMember } from '@/services/server/projectMembershipManagement';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(_request: Request, { params }: { params: { projectId: string; membershipId: string } }) {
  try {
    return jsonNoStore(await revokeProjectMember(params.projectId, params.membershipId));
  } catch (error) {
    const mapped = projectMembershipErrorResponse(error);
    return jsonNoStore(mapped.body, { status: mapped.status });
  }
}

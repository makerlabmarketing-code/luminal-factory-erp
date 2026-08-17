import { NextRequest, NextResponse } from 'next/server';
import { listProjectMembershipAudit, projectMembershipErrorResponse } from '@/services/server/projectMembershipManagement';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(request: NextRequest, props: { params: Promise<{ projectId: string }> }) {
  const params = await props.params;
  try {
    return jsonNoStore(await listProjectMembershipAudit(params.projectId, {
      cursor: request.nextUrl.searchParams.get('cursor'),
      limit: request.nextUrl.searchParams.get('limit'),
    }));
  } catch (error) {
    const mapped = projectMembershipErrorResponse(error);
    return jsonNoStore(mapped.body, { status: mapped.status });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { canAccessAdmin, canAccessStaff, requireAuthenticatedEmployee } from '@/services/server/auth';
import { resolveWorkspaceRedirectPath } from '@/utils/auth/flow';

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuthenticatedEmployee();
    const [adminAccess, staffAccess] = await Promise.all([
      canAccessAdmin(authContext),
      canAccessStaff(authContext),
    ]);
    const path = resolveWorkspaceRedirectPath(
      {
        canAccessAdmin: adminAccess.allowed,
        canAccessStaff: staffAccess.allowed,
      },
      request.nextUrl.searchParams.get('next')
    );

    return NextResponse.redirect(new URL(path, request.url));
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.getAll().forEach((cookie) => response.cookies.delete(cookie.name));
    return response;
  }
}

import { NextResponse } from 'next/server';

import { attendanceRecoveryStatus } from '@/lib/attendanceRecoveryGate';
import { AuthFlowError, hasPermission, requireWorkspaceAccess } from '@/services/server/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function GET() {
  const correlationId = crypto.randomUUID();

  try {
    const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE');
    if (!(await hasPermission(authContext, 'ATTENDANCE_VIEW'))) {
      throw new AuthFlowError({
        status: 403,
        code: 'permission_forbidden',
        message: 'Báº¡n khÃ´ng cÃ³ quyá»n xem tráº¡ng thÃ¡i váº­n hÃ nh chÃ¡º¥m cÃ´ng.',
        failureStage: 'permission_check',
      });
    }

    return jsonNoStore({
      success: true,
      gate: 'ATTENDANCE_RECOVERY_ENABLED',
      status: attendanceRecoveryStatus(process.env.ATTENDANCE_RECOVERY_ENABLED),
      correlationId,
    });
  } catch (error) {
    if (error instanceof AuthFlowError) {
      return jsonNoStore(
        {
          success: false,
          code: error.code,
          failureStage: error.failureStage,
          correlationId,
        },
        { status: error.status }
      );
    }

    console.error('[attendance-runtime-verification]', { correlationId, code: 'runtime_verification_failed' });
    return jsonNoStore(
      { success: false, code: 'runtime_verification_failed', correlationId },
      { status: 500 }
    );
  }
}

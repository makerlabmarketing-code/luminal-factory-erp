import { NextResponse } from 'next/server';

import {
  isEmployeeDiagnosticCorrelationId,
  readEmployeeCreatePersistenceDiagnostic,
} from '@/lib/employeePersistenceDiagnostics';
import { AuthFlowError } from '@/services/server/auth';
import { requireAdminEmployeePermission } from '@/services/server/adminEmployeeData';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function GET(
  _request: Request,
  { params }: { params: { correlationId: string } }
) {
  const correlationId = params.correlationId;

  if (!isEmployeeDiagnosticCorrelationId(correlationId)) {
    return jsonNoStore(
      {
        success: false,
        status: 'unavailable',
        code: 'employee_diagnostic_invalid_id',
        correlationId: null,
      },
      { status: 400 }
    );
  }

  try {
    await requireAdminEmployeePermission('EMPLOYEE_MANAGE');
    const diagnostic = readEmployeeCreatePersistenceDiagnostic(correlationId);
    if (!diagnostic) {
      return jsonNoStore(
        {
          success: false,
          status: 'unavailable',
          code: 'employee_diagnostic_unavailable',
          correlationId,
        },
        { status: 404 }
      );
    }

    return jsonNoStore({ success: true, status: 'available', diagnostic });
  } catch (error) {
    if (error instanceof AuthFlowError) {
      return jsonNoStore(
        {
          success: false,
          status: 'unavailable',
          code: error.code,
          failureStage: error.failureStage,
          correlationId,
        },
        { status: error.status }
      );
    }

    console.error('[employee-diagnostic-route]', {
      correlationId,
      code: 'employee_diagnostic_failed',
    });
    return jsonNoStore(
      {
        success: false,
        status: 'unavailable',
        code: 'employee_diagnostic_failed',
        correlationId,
      },
      { status: 500 }
    );
  }
}

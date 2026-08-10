import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { AdminClientError, createSupabaseAdminClient } from '@/utils/supabase/admin';
import { AuthFlowError, requireWorkspaceAccess } from '@/services/server/auth';
import {
  buildStaffProfileDatabaseUpdate,
  persistStaffProfile,
  sanitizePersistenceFailure,
  type MutationTrace,
} from '@/services/server/staffProfilePersistence';

const MAX_PROFILE_FIELD_LENGTH = 120;
const cleanProfileField = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, MAX_PROFILE_FIELD_LENGTH) : '';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function logFailure(params: {
  correlationId: string;
  employeeId?: string | number;
  code: string;
  failureStage: string;
  operation: string;
  trace: MutationTrace;
  error: unknown;
}) {
  const wrapped = params.error as { diagnosticCause?: unknown } | null;
  const diagnostic = sanitizePersistenceFailure(wrapped?.diagnosticCause ?? params.error);
  console.error('[staff-profile-persistence]', {
    correlationId: params.correlationId,
    route: '/api/staff/profile',
    method: 'PATCH',
    actorEmployeeId: params.employeeId == null ? null : String(params.employeeId),
    authorizationResult: params.employeeId == null ? 'not_completed' : 'allowed',
    failureStage: params.failureStage,
    code: params.code,
    sourceBoundary: 'app/api/staff/profile/route.ts:PATCH',
    coreMutationRan: params.trace.networkExecutionBegan,
    supabaseOperation: params.operation,
    targetRelation: 'public.employees',
    ...params.trace,
    ...diagnostic,
  });
}

const failureResponse = (correlationId: string, code: string, failureStage: string) =>
  jsonNoStore({ error: 'Không thể lưu hồ sơ nhân sự.', code, failureStage, correlationId }, { status: 500 });

export async function PATCH(request: Request) {
  const correlationId = crypto.randomUUID();
  const trace: MutationTrace = {
    clientCreationCompleted: false,
    updateBuilderCreated: false,
    networkExecutionBegan: false,
    resultErrorReturned: false,
    readbackBegan: false,
  };
  let employeeId: string | number | undefined;

  try {
    const authContext = await requireWorkspaceAccess('STAFF_WORKSPACE');
    employeeId = authContext.employee.id;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return jsonNoStore({ error: 'Dữ liệu hồ sơ không hợp lệ.' }, { status: 400 });

    const allowedKeys = new Set(['phone', 'bankName', 'bankAccountNumber']);
    if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
      return jsonNoStore({ error: 'Bạn không được phép cập nhật trường này.', correlationId }, { status: 403 });
    }
    const payload = buildStaffProfileDatabaseUpdate(body, cleanProfileField);

    let supabase;
    try {
      supabase = createSupabaseAdminClient();
      trace.clientCreationCompleted = true;
    } catch (error) {
      const code = error instanceof AdminClientError ? error.code : 'admin_client_creation_failed';
      logFailure({ correlationId, employeeId, code, failureStage: code === 'admin_client_configuration_failed' ? 'admin_client_configuration' : 'admin_client_creation', operation: 'client_creation', trace, error });
      return failureResponse(correlationId, code, code === 'admin_client_configuration_failed' ? 'admin_client_configuration' : 'admin_client_creation');
    }

    let result;
    try {
      result = await persistStaffProfile(supabase, employeeId, payload, trace);
    } catch (error) {
      logFailure({ correlationId, employeeId, code: 'employee_core_mutation_failed', failureStage: 'core_mutation', operation: 'update', trace, error });
      return failureResponse(correlationId, 'employee_core_mutation_failed', 'core_mutation');
    }

    const employee = result.data || {
      phone: Object.prototype.hasOwnProperty.call(payload, 'phone') ? payload.phone : authContext.employee.phone ?? null,
      bank_name: Object.prototype.hasOwnProperty.call(payload, 'bank_name') ? payload.bank_name : authContext.employee.bank_name ?? null,
      bank_account_number: Object.prototype.hasOwnProperty.call(payload, 'bank_account_number') ? payload.bank_account_number : authContext.employee.bank_account_number ?? null,
    };
    const warnings: string[] = [];
    if (result.readbackError || !result.data) {
      warnings.push('employee_core_readback_failed');
      console.warn('[staff-profile-persistence]', {
        correlationId, route: '/api/staff/profile', method: 'PATCH', actorEmployeeId: String(employeeId),
        authorizationResult: 'allowed', failureStage: 'core_readback', code: 'employee_core_readback_failed',
        coreMutationRan: true, mutationResult: 'persisted', supabaseOperation: 'select', targetRelation: 'public.employees',
        ...trace, ...sanitizePersistenceFailure(result.readbackError),
      });
    }

    revalidatePath('/staff');
    revalidatePath('/staff/profile');
    return jsonNoStore({ success: true, employee, warnings, correlationId });
  } catch (error) {
    if (error instanceof AuthFlowError) {
      logFailure({ correlationId, code: error.code, failureStage: error.failureStage, operation: 'authorization', trace, error });
      return jsonNoStore({ error: error.message, code: error.code, failureStage: error.failureStage, correlationId }, { status: error.status });
    }
    logFailure({ correlationId, employeeId, code: 'staff_profile_unhandled_failure', failureStage: 'request_boundary', operation: 'request', trace, error });
    return failureResponse(correlationId, 'staff_profile_unhandled_failure', 'request_boundary');
  }
}

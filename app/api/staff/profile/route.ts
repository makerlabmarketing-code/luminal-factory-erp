import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { AuthFlowError, requireWorkspaceAccess } from '@/services/server/auth';
import { revalidatePath } from 'next/cache';

const MAX_PROFILE_FIELD_LENGTH = 120;

function cleanProfileField(value: unknown): string {
  if (typeof value !== 'string') return '';

  return value.trim().slice(0, MAX_PROFILE_FIELD_LENGTH);
}

function toErrorResponse(correlationId: string, error: unknown) {
  if (error instanceof AuthFlowError) {
    console.error('[staff-profile-persistence]', {
      correlationId,
      route: '/api/staff/profile',
      method: 'PATCH',
      failureStage: error.failureStage,
      code: error.code,
      supabaseErrorCode: error.safeDetails?.supabase_error_code || null,
      coreMutationRan: false,
    });
    return NextResponse.json({ error: error.message, code: error.code, failureStage: error.failureStage, correlationId }, { status: error.status });
  }

  console.error('[staff-profile-persistence]', {
    correlationId,
    route: '/api/staff/profile',
    method: 'PATCH',
    failureStage: 'request_boundary',
    code: 'staff_profile_unhandled_failure',
    coreMutationRan: false,
    errorType: error instanceof Error ? error.name : 'unknown',
  });
  return NextResponse.json({ error: 'Không thể lưu hồ sơ nhân sự.', code: 'staff_profile_unhandled_failure', failureStage: 'request_boundary', correlationId }, { status: 500 });
}

export async function PATCH(request: Request) {
  const correlationId = crypto.randomUUID();
  try {
    const authContext = await requireWorkspaceAccess('STAFF_WORKSPACE');
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    if (!body) {
      return NextResponse.json({ error: 'Dữ liệu hồ sơ không hợp lệ.' }, { status: 400 });
    }

    const allowedKeys = new Set(['phone', 'bankName', 'bankAccountNumber']);
    if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
      return NextResponse.json({ error: 'Bạn không được phép cập nhật trường này.', correlationId }, { status: 403 });
    }
    const payload: Record<string, string> = {};
    if (Object.prototype.hasOwnProperty.call(body, 'phone')) payload.phone = cleanProfileField(body.phone);
    if (Object.prototype.hasOwnProperty.call(body, 'bankName')) payload.bank_name = cleanProfileField(body.bankName);
    if (Object.prototype.hasOwnProperty.call(body, 'bankAccountNumber')) payload.bank_account_number = cleanProfileField(body.bankAccountNumber);

    let supabase;
    try {
      supabase = createSupabaseAdminClient();
    } catch {
      console.error('[staff-profile-persistence]', {
        correlationId,
        route: '/api/staff/profile',
        method: 'PATCH',
        actorEmployeeId: String(authContext.employee.id),
        authorizationResult: 'allowed',
        failureStage: 'admin_client_creation',
        sourceBoundary: 'app/api/staff/profile/route.ts:PATCH',
        coreMutationRan: false,
        supabaseOperation: 'client_creation',
        targetRelation: 'public.employees',
      });
      return NextResponse.json({ error: 'Không thể lưu hồ sơ nhân sự.', code: 'staff_profile_admin_client_unavailable', failureStage: 'admin_client_creation', correlationId }, { status: 500 });
    }
    const { error } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', authContext.employee.id);

    if (error) {
      console.error('[staff-profile-persistence]', {
        correlationId,
        route: '/api/staff/profile',
        method: 'PATCH',
        actorEmployeeId: String(authContext.employee.id),
        authorizationResult: 'allowed',
        failureStage: 'core_mutation',
        sourceBoundary: 'app/api/staff/profile/route.ts:PATCH',
        coreMutationRan: true,
        supabaseOperation: 'update',
        targetRelation: 'public.employees',
        supabaseErrorCode: error.code || 'unknown',
      });
      return NextResponse.json({ error: 'Không thể lưu hồ sơ nhân sự.', code: 'staff_profile_persistence_failed', failureStage: 'core_mutation', correlationId }, { status: 500 });
    }

    const { data, error: readbackError } = await supabase
      .from('employees')
      .select('phone, bank_name, bank_account_number')
      .eq('id', authContext.employee.id)
      .maybeSingle();
    const employee = data || {
      phone: Object.prototype.hasOwnProperty.call(payload, 'phone') ? payload.phone : authContext.employee.phone ?? null,
      bank_name: Object.prototype.hasOwnProperty.call(payload, 'bank_name') ? payload.bank_name : authContext.employee.bank_name ?? null,
      bank_account_number: Object.prototype.hasOwnProperty.call(payload, 'bank_account_number') ? payload.bank_account_number : authContext.employee.bank_account_number ?? null,
    };

    if (readbackError || !data) {
      console.warn('[staff-profile-persistence]', {
        correlationId,
        route: '/api/staff/profile',
        method: 'PATCH',
        actorEmployeeId: String(authContext.employee.id),
        authorizationResult: 'allowed',
        failureStage: 'core_readback',
        sourceBoundary: 'app/api/staff/profile/route.ts:PATCH',
        coreMutationRan: true,
        mutationResult: 'persisted',
        supabaseOperation: 'select',
        targetRelation: 'public.employees',
        supabaseErrorCode: readbackError?.code || 'row_not_returned',
      });
    }

    revalidatePath('/staff');
    revalidatePath('/staff/profile');
    return NextResponse.json({ success: true, employee, warnings: readbackError || !data ? ['employee_readback_failed'] : [], correlationId });
  } catch (error) {
    return toErrorResponse(correlationId, error);
  }
}

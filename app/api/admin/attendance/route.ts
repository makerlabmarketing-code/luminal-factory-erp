import { NextResponse } from 'next/server';

import { createClient } from '@/utils/supabase/server';
import { businessMonthFromInstant, formatBusinessMonthInput } from '@/lib/business-date';
import { AttendanceDataError, loadAttendanceData } from '@/services/server/attendanceData';
import { AuthFlowError, hasPermission, requireWorkspaceAccess } from '@/services/server/auth';
import { isAttendanceManualMutationEnabled } from '@/lib/attendanceManualMutationGate';
import {
  normalizeRequiredAdminAttendanceReason,
} from '@/lib/adminAttendanceReason';

type AttendanceMutationBody = Record<string, unknown>;
type AttendanceAction = 'load' | 'update';

async function requireAttendanceView() {
  const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  if (!(await hasPermission(authContext, 'ATTENDANCE_VIEW'))) {
    throw new AuthFlowError({
      status: 403,
      code: 'permission_forbidden',
      message: 'Báº¡n khÃ´ng cÃ³ quyá»n xem dá»¯ liá»‡u cháº¥m cÃ´ng.',
      failureStage: 'permission_check',
    });
  }
  return authContext;
}

async function requireAttendanceManage() {
  const authContext = await requireAttendanceView();
  if (!(await hasPermission(authContext, 'ATTENDANCE_MANAGE'))) {
    throw new AuthFlowError({
      status: 403,
      code: 'permission_forbidden',
      message: 'Báº¡n khÃ´ng cÃ³ quyá»n Ä‘iá»u chá»‰nh cháº¥m cÃ´ng.',
      failureStage: 'permission_check',
    });
  }
  if (!isAttendanceManualMutationEnabled()) {
    throw new AuthFlowError({
      status: 503,
      code: 'attendance_manual_mutation_disabled',
      message: 'Äiá»u chá»‰nh cháº¥m cÃ´ng Ä‘ang chá» kÃ­ch hoáº¡t.',
      failureStage: 'permission_check',
    });
  }
  return authContext;
}

function toErrorResponse(error: unknown, action: AttendanceAction) {
  if (error instanceof AuthFlowError) {
    const permissionDenied = error.code === 'permission_forbidden' || error.code === 'workspace_forbidden';
    return NextResponse.json(
      {
        error: error.message,
        code: permissionDenied ? 'attendance_permission_denied' : error.code,
        failure_stage: error.failureStage,
      },
      { status: error.status }
    );
  }

  if (error instanceof AttendanceDataError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        failure_stage: error.failureStage,
        supabase_error_code: error.supabaseErrorCode ?? null,
      },
      { status: error.code === 'attendance_configuration_failed' ? 400 : 500 }
    );
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: unknown }).code || '');
    const status = code === '23505' ? 409 : code === '23503' ? 404 : code === '22007' || code === '22023' ? 400 : code === '55000' ? 409 : 500;
    const publicCode = code === '23505'
      ? 'attendance_conflict'
      : code === '23503'
        ? 'attendance_reference_not_found'
        : code === '22007' || code === '22023'
          ? 'attendance_invalid_mutation'
          : code === '55000'
            ? 'attendance_mutation_rejected'
            : action === 'load' ? 'attendance_load_failed' : 'attendance_update_failed';
    return NextResponse.json(
      {
        error: status === 409
          ? 'Báº£n ghi cháº¥m cÃ´ng Ä‘Ã£ thay Ä‘á»•i hoáº·c bá»‹ trÃ¹ng. Vui lÃ²ng táº£i láº¡i dá»¯ liá»‡u.'
          : status === 404
            ? 'KhÃ´ng tÃ¬m tháº¥y há»“ sÆ¡ liÃªn quan Ä‘áº¿n báº£n ghi cháº¥m cÃ´ng.'
            : status === 400
              ? 'Dá»¯ liá»‡u Ä‘iá»u chá»‰nh cháº¥m cÃ´ng khÃ´ng há»£p lá»‡.'
              : action === 'load' ? 'KhÃ´ng thá»ƒ táº£i dá»¯ liá»‡u cháº¥m cÃ´ng.' : 'KhÃ´ng thá»ƒ cáº­p nháº­t dá»¯ liá»‡u cháº¥m cÃ´ng.',
        code: publicCode,
        failure_stage: 'mutation',
      },
      { status }
    );
  }

  return NextResponse.json(
    {
      error: action === 'load' ? 'KhÃ´ng thá»ƒ táº£i dá»¯ liá»‡u cháº¥m cÃ´ng.' : 'KhÃ´ng thá»ƒ cáº­p nháº­t dá»¯ liá»‡u cháº¥m cÃ´ng.',
      code: action === 'load' ? 'attendance_load_failed' : 'attendance_update_failed',
      failure_stage: action === 'load' ? 'unknown_load_failure' : 'unknown_update_failure',
    },
    { status: 500 }
  );
}

const requiredFieldMessages: Record<string, string> = {
  employeeId: 'Vui lÃ²ng chá»n nhÃ¢n sá»±.',
  workDate: 'Vui lÃ²ng chá»n ngÃ y cháº¥m cÃ´ng.',
  shiftName: 'Vui lÃ²ng chá»n ca lÃ m viá»‡c.',
  checkIn: 'Vui lÃ²ng nháº­p giá» vÃ o.',
  checkOut: 'Vui lÃ²ng nháº­p giá» ra.',
};

function requiredString(body: AttendanceMutationBody, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AuthFlowError({
      status: 400,
      code: 'admin_verification_failed',
      message: requiredFieldMessages[key] || 'Thiáº¿u dá»¯ liá»‡u cháº¥m cÃ´ng báº¯t buá»™c.',
      failureStage: 'validation',
    });
  }
  return value.trim();
}

function numericId(value: unknown): string | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const normalized = value.trim().replace(/^0+(?=\d)/, '');
    return normalized === '0' ? null : normalized;
  }

  return null;
}

function requiredEmployeeId(body: AttendanceMutationBody): string {
  const employeeId = numericId(body.employeeId);
  if (!employeeId) {
    throw new AuthFlowError({
      status: 400,
      code: 'admin_verification_failed',
      message: requiredFieldMessages.employeeId,
      failureStage: 'validation',
    });
  }

  return employeeId;
}

function requiredTime(body: AttendanceMutationBody, key: 'checkIn' | 'checkOut'): string {
  const value = requiredString(body, key);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) {
    throw new AuthFlowError({
      status: 400,
      code: 'attendance_invalid_mutation',
      message: 'Giá» cháº¥m cÃ´ng khÃ´ng há»£p lá»‡.',
      failureStage: 'validation',
    });
  }

  return value.length === 5 ? `${value}:00` : value;
}

function requiredReason(body: AttendanceMutationBody): string {
  const reason = normalizeRequiredAdminAttendanceReason(body.reason);
  if (!reason) {
    throw new AuthFlowError({
      status: 400,
      code: 'attendance_reason_required',
      message: 'LÃ½ do Ä‘iá»u chá»‰nh pháº£i cÃ³ Ã­t nháº¥t 10 kÃ½ tá»±.',
      failureStage: 'validation',
    });
  }
  return reason;
}

function validateTimeOrdering(checkIn: string, checkOut: string): void {
  if (checkOut < checkIn) {
    throw new AuthFlowError({
      status: 400,
      code: 'attendance_invalid_time_order',
      message: 'Giá» ra pháº£i báº±ng hoáº·c sau giá» vÃ o.',
      failureStage: 'validation',
    });
  }
}

function optionalRecordId(body: AttendanceMutationBody): string | null {
  return numericId(body.recordId);
}

async function validateTargetEmployee(employeeId: string): Promise<void> {
  // Keep this lookup on the authenticated client so the existing RLS/workspace
  // boundary remains part of the target Employee validation. Do not use a
  // privileged client or accept a display/auth identifier here.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('employees')
    .select('id, status, is_active')
    .eq('id', employeeId)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.is_active === false || ['INACTIVE', 'LOCKED'].includes(String(data.status || '').toUpperCase())) {
    throw new AuthFlowError({
      status: 400,
      code: 'admin_verification_failed',
      message: 'NhÃ¢n sá»± khÃ´ng tá»“n táº¡i hoáº·c khÃ´ng cÃ²n hoáº¡t Ä‘á»™ng trong pháº¡m vi Ä‘Æ°á»£c phÃ©p.',
      failureStage: 'validation',
    });
  }
}

async function runAdminAttendanceMutation(params: {
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  recordId?: string | null;
  employeeId?: string | null;
  workDate?: string | null;
  shiftName?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  reason: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_attendance_mutation', {
    p_operation: params.operation,
    p_attendance_id: params.recordId ?? null,
    p_employee_id: params.employeeId ?? null,
    p_work_date: params.workDate ?? null,
    p_shift_name: params.shiftName ?? null,
    p_check_in: params.checkIn ?? null,
    p_check_out: params.checkOut ?? null,
    p_reason: params.reason,
    p_correlation_id: crypto.randomUUID(),
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data;
}

export async function GET(request: Request) {
  try {
    const authContext = await requireAttendanceView();
    const url = new URL(request.url);
    const monthInput = url.searchParams.get('month') || formatBusinessMonthInput(businessMonthFromInstant(new Date()));
    const employeeId = url.searchParams.get('employeeId') || null;
    const payload = await loadAttendanceData({ monthInput, employeeId, includeDiagnostics: Boolean(employeeId) });
    const canManage = await hasPermission(authContext, 'ATTENDANCE_MANAGE');
    let auditEvents: Array<Record<string, unknown>> = [];
    if (isAttendanceManualMutationEnabled()) {
      const supabase = await createClient();
      let auditQuery = supabase
        .from('attendance_operation_audit')
        .select('id, attendance_id, employee_id, actor_employee_id, operation, reason, before_state, after_state, correlation_id, occurred_at')
        .order('occurred_at', { ascending: false })
        .limit(200);
      if (employeeId) auditQuery = auditQuery.eq('employee_id', employeeId);
      const { data: auditData, error: auditError } = await auditQuery;
      if (auditError) throw auditError;
      auditEvents = (auditData || []) as Array<Record<string, unknown>>;
    }
    return NextResponse.json({
      ...payload,
      auditEvents,
      permissions: { canAdjustAttendance: canManage && isAttendanceManualMutationEnabled() },
    });
  } catch (error) {
    return toErrorResponse(error, 'load');
  }
}

export async function POST(request: Request) {
  try {
    await requireAttendanceManage();
    const body = (await request.json().catch(() => null)) as AttendanceMutationBody | null;
    if (!body) return NextResponse.json({ error: 'Thiáº¿u dá»¯ liá»‡u cháº¥m cÃ´ng.' }, { status: 400 });
    const employeeId = requiredEmployeeId(body);
    const checkIn = requiredTime(body, 'checkIn');
    const checkOut = requiredTime(body, 'checkOut');
    validateTimeOrdering(checkIn, checkOut);
    await validateTargetEmployee(employeeId);
    const result = await runAdminAttendanceMutation({
      operation: 'CREATE',
      employeeId,
      workDate: requiredString(body, 'workDate'),
      shiftName: requiredString(body, 'shiftName'),
      checkIn,
      checkOut,
      reason: requiredReason(body),
    });
    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    return toErrorResponse(error, 'update');
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAttendanceManage();
    const body = (await request.json().catch(() => null)) as AttendanceMutationBody | null;
    if (!body) return NextResponse.json({ error: 'Thiáº¿u dá»¯ liá»‡u cháº¥m cÃ´ng.' }, { status: 400 });
    const recordId = optionalRecordId(body);
    if (!recordId || String(recordId).startsWith('log-')) {
      return NextResponse.json({ error: 'Dá»¯ liá»‡u log cÅ© cáº§n Ä‘Æ°á»£c chuyá»ƒn Ä‘á»•i trÆ°á»›c khi Ä‘iá»u chá»‰nh.' }, { status: 400 });
    }
    const checkIn = requiredTime(body, 'checkIn');
    const checkOut = requiredTime(body, 'checkOut');
    validateTimeOrdering(checkIn, checkOut);
    const employeeId = requiredEmployeeId(body);
    await validateTargetEmployee(employeeId);
    const result = await runAdminAttendanceMutation({
      operation: 'UPDATE',
      recordId,
      employeeId,
      workDate: requiredString(body, 'workDate'),
      shiftName: requiredString(body, 'shiftName'),
      checkIn,
      checkOut,
      reason: requiredReason(body),
    });
    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    return toErrorResponse(error, 'update');
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAttendanceManage();
    const url = new URL(request.url);
    const recordId = numericId(url.searchParams.get('recordId'));
    if (!recordId) {
      return NextResponse.json({ error: 'Dá»¯ liá»‡u log cÅ© cáº§n Ä‘Æ°á»£c chuyá»ƒn Ä‘á»•i trÆ°á»›c khi xÃ³a.' }, { status: 400 });
    }
    const reason = (url.searchParams.get('reason') || '').trim();
    if (reason.length < 10) {
      return NextResponse.json({ error: 'LÃ½ do há»§y pháº£i cÃ³ Ã­t nháº¥t 10 kÃ½ tá»±.', code: 'attendance_cancellation_reason_required' }, { status: 400 });
    }
    const result = await runAdminAttendanceMutation({
      operation: 'DELETE',
      recordId,
      reason,
    });
    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    return toErrorResponse(error, 'update');
  }
}

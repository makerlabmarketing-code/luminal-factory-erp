import { NextResponse } from 'next/server';

import { createClient } from '@/utils/supabase/server';
import { businessMonthFromInstant, formatBusinessMonthInput } from '@/lib/business-date';
import { AttendanceDataError, loadAttendanceData } from '@/services/server/attendanceData';
import { AuthFlowError, hasPermission, requireWorkspaceAccess } from '@/services/server/auth';
import { isAttendanceManualMutationEnabled } from '@/lib/attendanceManualMutationGate';
import {
  normalizeAdminAttendanceCreateReason,
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
      message: 'Bạn không có quyền xem dữ liệu chấm công.',
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
      message: 'Bạn không có quyền điều chỉnh chấm công.',
      failureStage: 'permission_check',
    });
  }
  if (!isAttendanceManualMutationEnabled()) {
    throw new AuthFlowError({
      status: 503,
      code: 'attendance_manual_mutation_disabled',
      message: 'Điều chỉnh chấm công đang chờ kích hoạt.',
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
          ? 'Bản ghi chấm công đã thay đổi hoặc bị trùng. Vui lòng tải lại dữ liệu.'
          : status === 404
            ? 'Không tìm thấy hồ sơ liên quan đến bản ghi chấm công.'
            : status === 400
              ? 'Dữ liệu điều chỉnh chấm công không hợp lệ.'
              : action === 'load' ? 'Không thể tải dữ liệu chấm công.' : 'Không thể cập nhật dữ liệu chấm công.',
        code: publicCode,
        failure_stage: 'mutation',
      },
      { status }
    );
  }

  return NextResponse.json(
    {
      error: action === 'load' ? 'Không thể tải dữ liệu chấm công.' : 'Không thể cập nhật dữ liệu chấm công.',
      code: action === 'load' ? 'attendance_load_failed' : 'attendance_update_failed',
      failure_stage: action === 'load' ? 'unknown_load_failure' : 'unknown_update_failure',
    },
    { status: 500 }
  );
}

const requiredFieldMessages: Record<string, string> = {
  employeeId: 'Vui lòng chọn nhân sự.',
  workDate: 'Vui lòng chọn ngày chấm công.',
  shiftName: 'Vui lòng chọn ca làm việc.',
  checkIn: 'Vui lòng nhập giờ vào.',
  checkOut: 'Vui lòng nhập giờ ra.',
};

function requiredString(body: AttendanceMutationBody, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AuthFlowError({
      status: 400,
      code: 'admin_verification_failed',
      message: requiredFieldMessages[key] || 'Thiếu dữ liệu chấm công bắt buộc.',
      failureStage: 'validation',
    });
  }
  return value.trim();
}

function requiredReason(body: AttendanceMutationBody): string {
  const reason = normalizeRequiredAdminAttendanceReason(body.reason);
  if (!reason) {
    throw new AuthFlowError({
      status: 400,
      code: 'attendance_reason_required',
      message: 'Lý do điều chỉnh phải có ít nhất 10 ký tự.',
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
      message: 'Giờ ra phải bằng hoặc sau giờ vào.',
      failureStage: 'validation',
    });
  }
}

function optionalRecordId(body: AttendanceMutationBody): string | number | null {
  const recordId = body.recordId;
  if (typeof recordId === 'number' && Number.isFinite(recordId)) return recordId;
  if (typeof recordId === 'string' && recordId.trim() !== '') return recordId.trim();
  return null;
}

async function runAdminAttendanceMutation(params: {
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  recordId?: string | number | null;
  employeeId?: string | number | null;
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
    if (!body) return NextResponse.json({ error: 'Thiếu dữ liệu chấm công.' }, { status: 400 });
    const checkIn = requiredString(body, 'checkIn');
    const checkOut = requiredString(body, 'checkOut');
    validateTimeOrdering(checkIn, checkOut);
    const result = await runAdminAttendanceMutation({
      operation: 'CREATE',
      employeeId: requiredString(body, 'employeeId'),
      workDate: requiredString(body, 'workDate'),
      shiftName: requiredString(body, 'shiftName'),
      checkIn,
      checkOut,
      reason: normalizeAdminAttendanceCreateReason(body.reason),
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
    if (!body) return NextResponse.json({ error: 'Thiếu dữ liệu chấm công.' }, { status: 400 });
    const recordId = optionalRecordId(body);
    if (!recordId || String(recordId).startsWith('log-')) {
      return NextResponse.json({ error: 'Dữ liệu log cũ cần được chuyển đổi trước khi điều chỉnh.' }, { status: 400 });
    }
    const checkIn = requiredString(body, 'checkIn');
    const checkOut = requiredString(body, 'checkOut');
    validateTimeOrdering(checkIn, checkOut);
    const result = await runAdminAttendanceMutation({
      operation: 'UPDATE',
      recordId,
      employeeId: requiredString(body, 'employeeId'),
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
    const recordId = url.searchParams.get('recordId');
    if (!recordId || recordId.startsWith('log-')) {
      return NextResponse.json({ error: 'Dữ liệu log cũ cần được chuyển đổi trước khi xóa.' }, { status: 400 });
    }
    const reason = (url.searchParams.get('reason') || '').trim();
    if (reason.length < 10) {
      return NextResponse.json({ error: 'Lý do hủy phải có ít nhất 10 ký tự.', code: 'attendance_cancellation_reason_required' }, { status: 400 });
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

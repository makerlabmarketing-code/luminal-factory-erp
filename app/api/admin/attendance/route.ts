import { NextResponse } from 'next/server';

import { createClient } from '@/utils/supabase/server';
import {
  businessMonthFromInstant,
  formatBusinessMonthInput,
} from '@/lib/business-date';
import { calculateHoursFromStrings, calculateSalary } from '@/services/payrollService';
import { getEmployeeHourlyRate, normalizeTimeValue } from '@/services/attendanceService';
import { AttendanceDataError, loadAttendanceData } from '@/services/server/attendanceData';
import {
  AuthFlowError,
  hasPermission,
  requireWorkspaceAccess,
} from '@/services/server/auth';

type AttendanceMutationBody = Record<string, unknown>;
type AttendanceAction = 'load' | 'update';

function isAttendanceRecoveryEnabled() {
  return process.env.ATTENDANCE_RECOVERY_ENABLED === 'true';
}

async function requireAttendanceView() {
  const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  const canView = await hasPermission(authContext, 'ATTENDANCE_VIEW');

  if (!canView) {
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
  const canManage = await hasPermission(authContext, 'ATTENDANCE_MANAGE');

  if (!canManage) {
    throw new AuthFlowError({
      status: 403,
      code: 'permission_forbidden',
      message: 'Bạn không có quyền điều chỉnh chấm công.',
      failureStage: 'permission_check',
    });
  }

  if (!isAttendanceRecoveryEnabled()) {
    throw new AuthFlowError({
      status: 503,
      code: 'attendance_recovery_disabled',
      message: 'Điều chỉnh chấm công đang chờ kích hoạt.',
      failureStage: 'permission_check',
    });
  }

  return authContext;
}

function toErrorResponse(error: unknown, action: AttendanceAction) {
  if (error instanceof AuthFlowError) {
    const isPermissionDenied =
      error.code === 'permission_forbidden' || error.code === 'workspace_forbidden';

    return NextResponse.json(
      {
        error: error.message,
        code: isPermissionDenied ? 'attendance_permission_denied' : error.code,
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

  return NextResponse.json(
    {
      error:
        action === 'load'
          ? 'Không thể tải dữ liệu chấm công.'
          : 'Không thể cập nhật dữ liệu chấm công.',
      code: action === 'load' ? 'attendance_load_failed' : 'attendance_update_failed',
      failure_stage: action === 'load' ? 'unknown_load_failure' : 'unknown_update_failure',
    },
    { status: 500 }
  );
}

function requiredString(body: AttendanceMutationBody, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AuthFlowError({
      status: 400,
      code: 'admin_verification_failed',
      message: 'Thiếu dữ liệu chấm công bắt buộc.',
      failureStage: 'unknown',
    });
  }

  return value.trim();
}

function optionalRecordId(body: AttendanceMutationBody): string | number | null {
  const recordId = body.recordId;
  if (typeof recordId === 'number' && Number.isFinite(recordId)) return recordId;
  if (typeof recordId === 'string' && recordId.trim() !== '') return recordId.trim();

  return null;
}

async function getEmployeeById(employeeId: string | number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('employees')
    .select('id, full_name, title, hourly_rate')
    .eq('id', employeeId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new AuthFlowError({
      status: 404,
      code: 'employee_not_linked',
      message: 'Không tìm thấy nhân sự cần điều chỉnh.',
      failureStage: 'employee_lookup',
    });
  }

  return data;
}

function buildAttendancePayload(params: {
  employeeId: string | number;
  workDate: string;
  shiftName: string;
  checkIn: string;
  checkOut: string;
  hourlyRate: number;
}) {
  const checkIn = normalizeTimeValue(params.checkIn);
  const checkOut = normalizeTimeValue(params.checkOut);
  const totalHours = calculateHoursFromStrings(checkIn, checkOut);
  const totalSalary = calculateSalary(totalHours, params.hourlyRate);

  return {
    employee_id: params.employeeId,
    work_date: params.workDate,
    shift_name: params.shiftName,
    check_in: checkIn,
    check_out: checkOut,
    total_hours: totalHours,
    total_salary: totalSalary,
    status: 'PRESENT',
  };
}

export async function GET(request: Request) {
  try {
    const authContext = await requireAttendanceView();
    const url = new URL(request.url);
    const monthInput =
      url.searchParams.get('month') ||
      formatBusinessMonthInput(businessMonthFromInstant(new Date()));
    const employeeId = url.searchParams.get('employeeId') || null;
    const payload = await loadAttendanceData({ monthInput, employeeId });
    const canManage = await hasPermission(authContext, 'ATTENDANCE_MANAGE');

    return NextResponse.json({
      ...payload,
      permissions: {
        canAdjustAttendance: canManage && isAttendanceRecoveryEnabled(),
      },
    });
  } catch (error) {
    return toErrorResponse(error, 'load');
  }
}

export async function POST(request: Request) {
  try {
    await requireAttendanceManage();

    const body = (await request.json().catch(() => null)) as AttendanceMutationBody | null;
    if (!body) {
      return NextResponse.json({ error: 'Thiếu dữ liệu chấm công.' }, { status: 400 });
    }

    const employeeId = requiredString(body, 'employeeId');
    const workDate = requiredString(body, 'workDate');
    const shiftName = requiredString(body, 'shiftName');
    const checkIn = requiredString(body, 'checkIn');
    const checkOut = requiredString(body, 'checkOut');
    const employee = await getEmployeeById(employeeId);
    const payload = buildAttendancePayload({
      employeeId,
      workDate,
      shiftName,
      checkIn,
      checkOut,
      hourlyRate: getEmployeeHourlyRate(employee),
    });
    const supabase = await createClient();

    const { data: existingRecord, error: existingError } = await supabase
      .from('attendance')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('work_date', workDate)
      .eq('shift_name', shiftName)
      .maybeSingle();

    if (existingError) throw existingError;

    const result = existingRecord
      ? await supabase.from('attendance').update(payload).eq('id', existingRecord.id)
      : await supabase.from('attendance').insert([payload]);

    if (result.error) throw result.error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, 'update');
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAttendanceManage();

    const body = (await request.json().catch(() => null)) as AttendanceMutationBody | null;
    if (!body) {
      return NextResponse.json({ error: 'Thiếu dữ liệu chấm công.' }, { status: 400 });
    }

    const recordId = optionalRecordId(body);
    if (!recordId || String(recordId).startsWith('log-')) {
      return NextResponse.json(
        { error: 'Dữ liệu log cũ cần được chuyển đổi trước khi điều chỉnh.' },
        { status: 400 }
      );
    }

    const employeeId = requiredString(body, 'employeeId');
    const workDate = requiredString(body, 'workDate');
    const shiftName = requiredString(body, 'shiftName');
    const checkIn = requiredString(body, 'checkIn');
    const checkOut = requiredString(body, 'checkOut');
    const employee = await getEmployeeById(employeeId);
    const payload = buildAttendancePayload({
      employeeId,
      workDate,
      shiftName,
      checkIn,
      checkOut,
      hourlyRate: getEmployeeHourlyRate(employee),
    });
    const supabase = await createClient();
    const { error } = await supabase
      .from('attendance')
      .update(payload)
      .eq('id', recordId)
      .eq('employee_id', employeeId);

    if (error) throw error;

    return NextResponse.json({ success: true });
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
      return NextResponse.json(
        { error: 'Dữ liệu log cũ cần được chuyển đổi trước khi xóa.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { error } = await supabase.from('attendance').delete().eq('id', recordId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, 'update');
  }
}

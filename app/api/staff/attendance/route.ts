import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getDistance } from 'geolib';
import { createClient } from '@/utils/supabase/server';
import {
  businessMonthFromDateInput,
  businessMonthFromInstant,
  formatBusinessDateInput,
  formatBusinessMonthInput,
  businessDateFromInstant,
} from '@/lib/business-date';
import type { AttendanceRecord } from '@/lib/types/attendance';
import type { Facility } from '@/lib/types/facility';
import { calculateHoursFromStrings, calculateSalary } from '@/services/payrollService';
import {
  getAttendanceShiftName,
  isOpenAttendanceRecordStale,
  resolveAttendanceShiftState,
} from '@/services/attendanceService';
import { loadAttendanceData } from '@/services/server/attendanceData';
import {
  AuthFlowError,
  requireWorkspaceAccess,
  type ServerEmployee,
} from '@/services/server/auth';
import { loadFacilityDirectory } from '@/services/server/facilityDirectory';

const ATTENDANCE_SELECT =
  'id, employee_id, work_date, shift_name, check_in, check_out, total_hours, total_salary, status, cancelled_at';
const STAFF_ATTENDANCE_ALLOWED_FIELDS = new Set(['action', 'month', 'userLat', 'userLng']);

class StaffAttendanceError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'StaffAttendanceError';
    this.status = status;
    this.code = code;
  }
}

function normalizeTimeValue(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length === 5 ? `${value}:00` : value;
}

function getEmployeeHourlyRate(employee: ServerEmployee): number {
  const rate = Number(employee.hourly_rate ?? 30000);
  return Number.isFinite(rate) && rate >= 0 ? rate : 30000;
}

function findMatchedBranch(employee: ServerEmployee, branches: Facility[]): Facility | null {
  const matchedBranch = branches.find((branch) => {
    if (String(employee.branch_code || '') === String(branch.id || '')) return true;
    if (employee.branch_code && employee.branch_code === branch.code) return true;

    const branchNameLower = branch.facility_name?.toLowerCase();
    if (employee.branch_code?.toLowerCase() === branchNameLower) return true;

    return false;
  });

  return matchedBranch || null;
}

function resolveBranchName(branch?: Facility | null) {
  return branch?.facility_name || branch?.name || 'Chưa gán cơ sở';
}

async function loadFacilities() {
  const directory = await loadFacilityDirectory(await createClient());
  const facilities = directory.facilities;
  return facilities.filter((facility) => facility.isActive).map((facility) => ({
    id: facility.id,
    code: facility.code,
    facility_name: facility.name,
    lat: facility.lat,
    lng: facility.lng,
    radius: facility.radius,
    is_active: facility.isActive,
  }));
}

async function getOpenAttendanceRecord(employeeId: number | string, workDate?: string) {
  const supabase = await createClient();
  let query = supabase
    .from('attendance')
    .select(ATTENDANCE_SELECT)
    .eq('employee_id', employeeId)
    .is('check_out', null)
    .not('check_in', 'is', null)
    .order('work_date', { ascending: false })
    .order('id', { ascending: false })
    .limit(1);

  if (workDate) {
    query = query.eq('work_date', workDate);
  }

  const { data, error } = await query;

  if (error) throw error;

  return ((data as AttendanceRecord[] | null)?.[0]) || null;
}

async function getAttendanceRecordByShift(
  employeeId: number | string,
  workDate: string,
  shiftName: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('attendance')
    .select(ATTENDANCE_SELECT)
    .eq('employee_id', employeeId)
    .eq('work_date', workDate)
    .eq('shift_name', shiftName)
    .order('id', { ascending: true })
    .limit(1);

  if (error) throw error;

  return ((data as AttendanceRecord[] | null)?.[0]) || null;
}

function safeAttendanceErrorDetails(error: unknown) {
  if (error instanceof AuthFlowError) {
    return {
      code: error.code,
      failureStage: error.failureStage,
      status: error.status,
      supabaseErrorCode: error.safeDetails?.supabase_error_code || null,
    };
  }

  if (error && typeof error === 'object' && 'code' in error) {
    return {
      code: String((error as { code?: unknown }).code || 'unknown'),
      failureStage: 'persistence',
    };
  }

  return { code: 'attendance_load_failed', failureStage: 'unknown' };
}

function logStaffAttendanceBoundary(params: {
  correlationId: string;
  route: '/api/staff/attendance';
  code: string;
  authStage?: string;
  employeeStage?: string;
  workspaceStage?: string;
  attendanceStage?: string;
  facilityStage?: string;
  retryable: boolean;
  error?: unknown;
}) {
  console.error('[staff-portal]', {
    correlationId: params.correlationId,
    route: params.route,
    code: params.code,
    authStage: params.authStage || null,
    employeeStage: params.employeeStage || null,
    workspaceStage: params.workspaceStage || null,
    attendanceStage: params.attendanceStage || null,
    facilityStage: params.facilityStage || null,
    retryable: params.retryable,
    error: params.error ? safeAttendanceErrorDetails(params.error) : null,
  });
}

async function loadOptionalMatchedBranch(employee: ServerEmployee): Promise<Facility | null> {
  try {
    const branches = await loadFacilities();
    return findMatchedBranch(employee, branches);
  } catch (error) {
    logStaffAttendanceBoundary({
      correlationId: crypto.randomUUID(),
      route: '/api/staff/attendance',
      code: 'facility_lookup_failed',
      authStage: 'verified',
      employeeStage: 'resolved',
      workspaceStage: 'allowed',
      facilityStage: 'failed',
      retryable: true,
      error,
    });
    return null;
  }
}

async function loadAttendancePayload(
  employee: ServerEmployee,
  monthInput: string,
  now = new Date()
) {
  businessMonthFromDateInput(monthInput);
  const todayStr = formatBusinessDateInput(businessDateFromInstant(now));

  const openRecord = await getOpenAttendanceRecord(employee.id);
  const shiftState = resolveAttendanceShiftState(openRecord, now);
  const currentShiftName = getAttendanceShiftName(now);
  const currentShiftRecord =
    shiftState === 'ACTIVE_SHIFT_TODAY'
      ? openRecord
      : await getAttendanceRecordByShift(employee.id, todayStr, currentShiftName);
  const matchedBranch = await loadOptionalMatchedBranch(employee);
  const attendancePayload = await loadAttendanceData({
    monthInput,
    employeeId: employee.id,
    includeDirectory: false,
  });

  return {
    employee: {
      id: employee.id,
      employee_id: employee.employee_id ?? null,
      full_name: employee.full_name,
      title: employee.title ?? null,
      branch: employee.branch ?? null,
      branch_code: employee.branch_code ?? null,
      hourly_rate: employee.hourly_rate ?? null,
    },
    localBranchName: resolveBranchName(matchedBranch),
    shiftState,
    currentShift: shiftState === 'ACTIVE_SHIFT_TODAY' ? openRecord : null,
    staleOpenShift: shiftState === 'STALE_OPEN_SHIFT' ? openRecord : null,
    todayRecord: currentShiftRecord || null,
    isInShift: shiftState === 'ACTIVE_SHIFT_TODAY',
    attendanceHistory: attendancePayload.attendanceRecords,
    sourceCounts: attendancePayload.sourceCounts,
  };
}

function toStaffAttendanceErrorResponse(error: unknown) {
  const correlationId = crypto.randomUUID();

  if (error instanceof StaffAttendanceError) {
    logStaffAttendanceBoundary({
      correlationId,
      route: '/api/staff/attendance',
      code: error.code,
      attendanceStage: error.code,
      retryable: error.status >= 500,
      error,
    });
    return NextResponse.json(
      { error: error.message, code: error.code, correlationId },
      { status: error.status }
    );
  }

  if (error instanceof AuthFlowError) {
    const codeByAuthCode: Record<string, string> = {
      session_not_verified: 'attendance_unauthenticated',
      employee_not_linked: 'attendance_employee_not_found',
      employee_inactive: 'attendance_employee_inactive',
      workspace_forbidden: 'attendance_workspace_required',
    };
    logStaffAttendanceBoundary({
      correlationId,
      route: '/api/staff/attendance',
      code: codeByAuthCode[error.code] || 'attendance_load_failed',
      authStage: error.failureStage,
      employeeStage: error.failureStage === 'employee_lookup' ? 'failed' : undefined,
      workspaceStage: error.failureStage === 'workspace_access' ? 'failed' : undefined,
      retryable: error.status >= 500,
      error,
    });
    return NextResponse.json(
      { error: error.message, code: codeByAuthCode[error.code] || 'attendance_load_failed', correlationId },
      { status: error.status }
    );
  }

  logStaffAttendanceBoundary({
    correlationId,
    route: '/api/staff/attendance',
    code: 'attendance_load_failed',
    attendanceStage: 'unknown',
    retryable: true,
    error,
  });
  return NextResponse.json(
    { error: 'Không thể xử lý dữ liệu chấm công.', code: 'attendance_load_failed', correlationId },
    { status: 500 }
  );
}

function assertKnownPostFields(body: Record<string, unknown>) {
  const unknownFields = Object.keys(body).filter((key) => !STAFF_ATTENDANCE_ALLOWED_FIELDS.has(key));

  if (unknownFields.length > 0) {
    throw new StaffAttendanceError(
      422,
      'attendance_invalid_payload',
      'Dữ liệu chấm công không hợp lệ.'
    );
  }
}

export async function GET(request: Request) {
  try {
    const authContext = await requireWorkspaceAccess('STAFF_WORKSPACE');
    const url = new URL(request.url);
    const monthInput =
      url.searchParams.get('month') ||
      formatBusinessMonthInput(businessMonthFromInstant(new Date()));

    const payload = await loadAttendancePayload(authContext.employee, monthInput);

    return NextResponse.json(payload);
  } catch (error) {
    return toStaffAttendanceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const authContext = await requireWorkspaceAccess('STAFF_WORKSPACE');
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    if (!body) {
      return NextResponse.json(
        { error: 'Dữ liệu chấm công không hợp lệ.', code: 'attendance_invalid_payload' },
        { status: 422 }
      );
    }

    assertKnownPostFields(body);

    const action = body.action;
    if (action !== 'check_in' && action !== 'check_out') {
      throw new StaffAttendanceError(
        422,
        'attendance_invalid_payload',
        'Thao tác chấm công không hợp lệ.'
      );
    }

    const monthInput =
      typeof body.month === 'string'
        ? body.month
        : formatBusinessMonthInput(businessMonthFromInstant(new Date()));
    try {
      businessMonthFromDateInput(monthInput);
    } catch {
      throw new StaffAttendanceError(
        422,
        'attendance_invalid_payload',
        'Kỳ chấm công không hợp lệ.'
      );
    }

    const now = new Date();
    const todayStr = formatBusinessDateInput(businessDateFromInstant(now));
    const timeStr = now.toLocaleTimeString('vi-VN', {
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    const currentShift = getAttendanceShiftName(now);
    const openRecord = await getOpenAttendanceRecord(authContext.employee.id);
    const supabase = await createClient();

    if (openRecord && isOpenAttendanceRecordStale(openRecord, now)) {
      throw new StaffAttendanceError(
        409,
        'attendance_stale_shift_operator_required',
        'Có ca làm trước đó chưa được kết thúc. Vui lòng báo quản lý để kiểm tra.'
      );
    }

    if (action === 'check_out') {
      if (!openRecord) {
        throw new StaffAttendanceError(
          409,
          'attendance_no_open_shift',
          'Không có ca đang mở để kết thúc.'
        );
      }

      const timeOut = normalizeTimeValue(timeStr);
      const totalHours = calculateHoursFromStrings(openRecord.check_in || null, timeOut);
      const totalSalary = calculateSalary(totalHours, getEmployeeHourlyRate(authContext.employee));
      const { data, error } = await supabase
        .from('attendance')
        .update({
          check_out: timeOut,
          total_hours: totalHours,
          total_salary: totalSalary,
          status: 'PRESENT',
        })
        .eq('id', openRecord.id)
        .eq('employee_id', authContext.employee.id)
        .is('check_out', null)
        .select(ATTENDANCE_SELECT)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new StaffAttendanceError(
          409,
          'attendance_shift_changed',
          'Ca làm đã thay đổi. Vui lòng tải lại dữ liệu.'
        );
      }

      revalidatePath('/staff/attendance');
      const attendance = await loadAttendancePayload(authContext.employee, monthInput, now);

      return NextResponse.json({
        success: true,
        code: 'attendance_checked_out',
        message: `Đã tan ca [${openRecord.shift_name}] thành công.`,
        record: data,
        attendance,
      });
    }

    if (openRecord) {
      throw new StaffAttendanceError(
        409,
        'attendance_already_checked_in',
        'Bạn đang có một ca làm việc chưa kết thúc.'
      );
    }

    const existingShift = await getAttendanceRecordByShift(
      authContext.employee.id,
      todayStr,
      currentShift
    );

    if (existingShift) {
      throw new StaffAttendanceError(
        409,
        'attendance_already_checked_out',
        `Ca [${currentShift}] đã có dữ liệu chấm công.`
      );
    }

    const userLat = Number(body.userLat);
    const userLng = Number(body.userLng);

    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      throw new StaffAttendanceError(
        422,
        'attendance_invalid_payload',
        'Thiếu thông tin định vị hợp lệ.'
      );
    }

    const branches = await loadFacilities();
    const matchedBranch = findMatchedBranch(authContext.employee, branches);

    if (!matchedBranch || !matchedBranch.lat || !matchedBranch.lng || !matchedBranch.radius) {
      throw new StaffAttendanceError(
        500,
        'attendance_load_failed',
        'Cơ sở được giao chưa được cấu hình tọa độ GPS.'
      );
    }

    const distance = getDistance(
      { latitude: userLat, longitude: userLng },
      { latitude: Number(matchedBranch.lat), longitude: Number(matchedBranch.lng) }
    );

    if (distance > Number(matchedBranch.radius)) {
      throw new StaffAttendanceError(
        403,
        'attendance_location_out_of_range',
        `Vị trí sai. Bạn đang cách cơ sở khoảng ${Math.round(distance)} mét.`
      );
    }

    const openRecordAfterLocation = await getOpenAttendanceRecord(
      authContext.employee.id,
      todayStr
    );
    const existingShiftAfterLocation = await getAttendanceRecordByShift(
      authContext.employee.id,
      todayStr,
      currentShift
    );
    if (openRecordAfterLocation || existingShiftAfterLocation) {
      throw new StaffAttendanceError(
        409,
        'attendance_already_checked_in',
        'Ca làm đã được ghi nhận. Vui lòng tải lại dữ liệu.'
      );
    }

    const { data, error } = await supabase
      .from('attendance')
      .insert([
        {
          employee_id: authContext.employee.id,
          work_date: todayStr,
          shift_name: currentShift,
          check_in: normalizeTimeValue(timeStr),
          status: 'PRESENT',
        },
      ])
      .select(ATTENDANCE_SELECT)
      .single();

    if (error) throw error;

    revalidatePath('/staff/attendance');
    const attendance = await loadAttendancePayload(authContext.employee, monthInput, now);

    return NextResponse.json({
      success: true,
      code: 'attendance_checked_in',
      message: `Đã ghi nhận [${currentShift}] lúc ${timeStr}.`,
      record: data,
      attendance,
    });
  } catch (error) {
    return toStaffAttendanceErrorResponse(error);
  }
}

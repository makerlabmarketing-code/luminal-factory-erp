import {
  calculateActualHoursFromMinutes,
  calculateHoursFromStrings,
  calculateSalary,
  calculateWorkedMinutesFromStrings,
} from './payrollService';
import type { AttendanceRecord, Shift } from '@/lib/types/attendance';
import type { Employee } from '@/lib/types/employee';

const SHIFT_MINUTES = 180;

async function createBrowserDataClient() {
  const { createClient } = await import('@/utils/supabase/client');
  return createClient();
}

export function getEmployeeHourlyRate(employee: Employee | undefined | null): number {
  return Number(employee?.hourly_rate || 30000);
}

export function normalizeTimeValue(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length === 5 ? `${value}:00` : value;
}

export function calculateShiftUnitsFromHours(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;

  return calculateShiftUnitsFromMinutes(Math.round(hours * 60));
}

export function calculateShiftUnitsFromMinutes(workedMinutes: number): number {
  if (!Number.isFinite(workedMinutes) || workedMinutes <= 0) return 0;
  if (workedMinutes <= SHIFT_MINUTES) return 1;
  if (workedMinutes <= SHIFT_MINUTES * 2) return 2;

  return 3;
}

function normalizeHoursValue(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : null;
}

function toComparableTime(value: string | null | undefined): string | null {
  if (!value) return null;

  return normalizeTimeValue(value)?.slice(0, 8) || null;
}

function earlierTime(first: string | null | undefined, second: string | null | undefined) {
  const normalizedFirst = toComparableTime(first);
  const normalizedSecond = toComparableTime(second);

  if (!normalizedFirst) return normalizedSecond;
  if (!normalizedSecond) return normalizedFirst;

  return normalizedFirst <= normalizedSecond ? normalizedFirst : normalizedSecond;
}

function laterTime(first: string | null | undefined, second: string | null | undefined) {
  const normalizedFirst = toComparableTime(first);
  const normalizedSecond = toComparableTime(second);

  if (!normalizedFirst) return normalizedSecond;
  if (!normalizedSecond) return normalizedFirst;

  return normalizedFirst >= normalizedSecond ? normalizedFirst : normalizedSecond;
}

export function getWorkedMinutesForRecord(record: AttendanceRecord, now = new Date()): number {
  const storedHours = normalizeHoursValue(record.total_hours);
  if (storedHours !== null && record.check_out) {
    return Math.round(storedHours * 60);
  }

  if (record.check_in && record.check_out) {
    return calculateWorkedMinutesFromStrings(record.check_in, record.check_out);
  }

  if (record.check_in && !record.check_out) {
    const recordStart = new Date(`${record.work_date}T${record.check_in.slice(0, 8)}`);
    if (!Number.isFinite(recordStart.getTime()) || now.getTime() <= recordStart.getTime()) {
      return 0;
    }

    return Math.floor((now.getTime() - recordStart.getTime()) / 60000);
  }

  return 0;
}

export function enrichAttendanceRecord(record: AttendanceRecord, now = new Date()): AttendanceRecord {
  const workedMinutes = getWorkedMinutesForRecord(record, now);

  return {
    ...record,
    total_worked_minutes: workedMinutes,
    calculated_shifts: calculateShiftUnitsFromMinutes(workedMinutes),
  };
}

export function formatWorkedDuration(workedMinutes: number | null | undefined): string {
  if (!workedMinutes || workedMinutes <= 0) return '0 phút';

  const hours = Math.floor(workedMinutes / 60);
  const minutes = workedMinutes % 60;

  if (hours <= 0) return `${minutes} phút`;
  if (minutes <= 0) return `${hours} giờ`;

  return `${hours} giờ ${minutes} phút`;
}

function throwAttendanceError(error: unknown): never {
  if (error instanceof Error) throw error;

  if (error && typeof error === 'object' && 'message' in error) {
    throw new Error(String((error as { message?: unknown }).message));
  }

  throw new Error('Không thể ghi dữ liệu chấm công.');
}

export function mergeAttendanceRecords(records: AttendanceRecord[]): AttendanceRecord[] {
  const mergedMap = new Map<string, AttendanceRecord>();

  records.forEach((record) => {
    const key = `${record.employee_id}-${record.work_date}-${record.shift_name}`;
    const existing = mergedMap.get(key);

    if (!existing) {
      mergedMap.set(key, { ...record });
      return;
    }

    const prefersCurrentId = Boolean(record.check_out && !existing.check_out);
    const mergedCheckIn = earlierTime(existing.check_in, record.check_in);
    const mergedCheckOut = laterTime(existing.check_out, record.check_out);
    const calculatedTotalHours =
      mergedCheckIn && mergedCheckOut
        ? calculateActualHoursFromMinutes(calculateWorkedMinutesFromStrings(mergedCheckIn, mergedCheckOut))
        : null;
    const mergedTotalHours =
      normalizeHoursValue(existing.total_hours) ??
      normalizeHoursValue(record.total_hours) ??
      calculatedTotalHours;
    const mergedTotalSalary = existing.total_salary ?? record.total_salary ?? null;

    mergedMap.set(key, {
      ...existing,
      id: prefersCurrentId ? record.id : existing.id,
      employee_name: existing.employee_name || record.employee_name || null,
      check_in: mergedCheckIn,
      check_out: mergedCheckOut,
      total_hours: mergedTotalHours,
      total_salary: mergedTotalSalary,
      status: existing.status || record.status || null,
      total_worked_minutes: getWorkedMinutesForRecord({
        ...existing,
        check_in: mergedCheckIn,
        check_out: mergedCheckOut,
        total_hours: mergedTotalHours,
      }),
      calculated_shifts: calculateShiftUnitsFromMinutes(getWorkedMinutesForRecord({
        ...existing,
        check_in: mergedCheckIn,
        check_out: mergedCheckOut,
        total_hours: mergedTotalHours,
      })),
    });
  });

  return Array.from(mergedMap.values()).map((record) => enrichAttendanceRecord(record));
}

export function isAttendanceRecordComplete(record: AttendanceRecord): boolean {
  return Boolean(record.check_in && record.check_out);
}

export function isMissingCheckoutRecord(record: AttendanceRecord): boolean {
  return Boolean(record.check_in && !record.check_out);
}

export function isOpenAttendanceRecordStale(
  record: AttendanceRecord,
  now = new Date()
): boolean {
  if (!isMissingCheckoutRecord(record)) return false;

  const currentWorkDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  return record.work_date < currentWorkDate;
}

export function isAttendanceRecordOverdue(params: {
  record: AttendanceRecord;
  shifts: Shift[];
  now?: Date;
}): boolean {
  if (!isMissingCheckoutRecord(params.record)) return false;

  const shift = params.shifts.find((item) => item.shift_name === params.record.shift_name);
  const shiftEnd = shift?.end_time?.slice(0, 5);
  if (!shiftEnd) return false;

  const cutoff = new Date(`${params.record.work_date}T${shiftEnd}:00`);
  const now = params.now || new Date();

  return Number.isFinite(cutoff.getTime()) && cutoff.getTime() <= now.getTime();
}

export async function getOpenAttendanceRecord(params: {
  employeeId: number | string;
  workDate: string;
}): Promise<AttendanceRecord | null> {
  const supabase = await createBrowserDataClient();
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', params.employeeId)
    .eq('work_date', params.workDate)
    .is('check_out', null)
    .not('check_in', 'is', null)
    .order('id', { ascending: false })
    .limit(1);

  if (error) throwAttendanceError(error);

  return ((data as AttendanceRecord[] | null)?.[0]) || null;
}

export async function getAttendanceRecordByShift(params: {
  employeeId: number | string;
  workDate: string;
  shiftName: string;
}): Promise<AttendanceRecord | null> {
  const supabase = await createBrowserDataClient();
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', params.employeeId)
    .eq('work_date', params.workDate)
    .eq('shift_name', params.shiftName)
    .order('id', { ascending: true })
    .limit(1);

  if (error) throwAttendanceError(error);

  return ((data as AttendanceRecord[] | null)?.[0]) || null;
}

export async function checkInAttendance(params: {
  employee: Employee;
  workDate: string;
  shiftName: string;
  checkIn: string;
}): Promise<void> {
  const supabase = await createBrowserDataClient();
  const existingRecord = await getAttendanceRecordByShift({
    employeeId: params.employee.id,
    workDate: params.workDate,
    shiftName: params.shiftName,
  });

  if (existingRecord) {
    if (existingRecord.check_in) return;

    const { error } = await supabase
      .from('attendance')
      .update({
        check_in: normalizeTimeValue(params.checkIn),
        status: 'PRESENT',
      })
      .eq('id', existingRecord.id);

    if (error) throwAttendanceError(error);
    return;
  }

  const { error } = await supabase.from('attendance').insert([
    {
      employee_id: params.employee.id,
      work_date: params.workDate,
      shift_name: params.shiftName,
      check_in: normalizeTimeValue(params.checkIn),
      status: 'PRESENT',
    },
  ]);

  if (error) throwAttendanceError(error);
}

export async function checkOutAttendance(params: {
  record: AttendanceRecord;
  checkOut: string;
  hourlyRate: number;
}): Promise<void> {
  const supabase = await createBrowserDataClient();
  const timeOut = normalizeTimeValue(params.checkOut);
  const totalHours = calculateHoursFromStrings(params.record.check_in || null, timeOut);
  const totalSalary = calculateSalary(totalHours, params.hourlyRate);

  const { error } = await supabase
    .from('attendance')
    .update({
      check_out: timeOut,
      total_hours: totalHours,
      total_salary: totalSalary,
      status: 'PRESENT',
    })
    .eq('id', params.record.id);

  if (error) throwAttendanceError(error);
}

export async function updateAttendanceRecordTime(params: {
  recordId: number | string;
  employeeId: number | string;
  workDate: string;
  shiftName: string;
  checkIn: string;
  checkOut: string;
  hourlyRate: number;
}): Promise<void> {
  const response = await fetch('/api/admin/attendance', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recordId: params.recordId,
      employeeId: params.employeeId,
      workDate: params.workDate,
      shiftName: params.shiftName,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
    }),
  });

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(result?.error || 'Không thể cập nhật giờ công.');
  }
}

export async function upsertAttendanceRecord(params: {
  employee: Employee;
  workDate: string;
  shiftName: string;
  checkIn: string;
  checkOut: string;
  hourlyRate: number;
}): Promise<void> {
  const response = await fetch('/api/admin/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employeeId: params.employee.id,
      workDate: params.workDate,
      shiftName: params.shiftName,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
    }),
  });

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(result?.error || 'Không thể bổ sung ca làm việc.');
  }
}

export async function deleteAttendanceRecord(recordId: number | string): Promise<void> {
  const response = await fetch(`/api/admin/attendance?recordId=${encodeURIComponent(String(recordId))}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(result?.error || 'Không thể xóa bản ghi.');
  }
}

export function hasDuplicatedShift(params: {
  records: AttendanceRecord[];
  employeeId: number | string;
  workDate: string;
  shiftName: string;
}): boolean {
  return params.records.some((record) => {
    return (
      String(record.employee_id) === String(params.employeeId) &&
      record.work_date === params.workDate &&
      record.shift_name === params.shiftName
    );
  });
}

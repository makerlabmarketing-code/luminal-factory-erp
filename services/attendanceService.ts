import { supabase } from '@/lib/supabase';
import { calculateHoursFromStrings, calculateSalary } from '@/services/payrollService';
import type { AttendanceRecord, Shift } from '@/lib/types/attendance';
import type { Employee } from '@/lib/types/employee';

export function getEmployeeHourlyRate(employee: Employee | undefined | null): number {
  return Number(employee?.hourly_rate || employee?.base_salary_per_hour || 30000);
}

export function normalizeTimeValue(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length === 5 ? `${value}:00` : value;
}

export function calculateShiftUnitsFromHours(hours: number): number {
  if (hours <= 0) return 0;
  return Math.ceil(hours / 3);
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

    const prefersCurrentId = record.check_out && !existing.check_out;
    const mergedCheckIn = existing.check_in || record.check_in || null;
    const mergedCheckOut = existing.check_out || record.check_out || null;
    const mergedTotalHours =
      existing.total_hours ?? record.total_hours ?? (mergedCheckIn && mergedCheckOut
        ? calculateHoursFromStrings(mergedCheckIn, mergedCheckOut)
        : null);
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
    });
  });

  return Array.from(mergedMap.values());
}

export function isAttendanceRecordComplete(record: AttendanceRecord): boolean {
  return Boolean(record.check_in && record.check_out);
}

export function isMissingCheckoutRecord(record: AttendanceRecord): boolean {
  return Boolean(record.check_in && !record.check_out);
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
  checkIn: string;
  checkOut: string;
  hourlyRate: number;
}): Promise<void> {
  const timeIn = normalizeTimeValue(params.checkIn);
  const timeOut = normalizeTimeValue(params.checkOut);
  const totalHours = calculateHoursFromStrings(timeIn, timeOut);
  const totalSalary = calculateSalary(totalHours, params.hourlyRate);

  const { error } = await supabase
    .from('attendance')
    .update({
      check_in: timeIn,
      check_out: timeOut,
      total_hours: totalHours,
      total_salary: totalSalary,
      status: 'PRESENT',
    })
    .eq('id', params.recordId);

  if (error) throwAttendanceError(error);
}

export async function upsertAttendanceRecord(params: {
  employee: Employee;
  workDate: string;
  shiftName: string;
  checkIn: string;
  checkOut: string;
  hourlyRate: number;
}): Promise<void> {
  const timeIn = normalizeTimeValue(params.checkIn);
  const timeOut = normalizeTimeValue(params.checkOut);
  const totalHours = calculateHoursFromStrings(timeIn, timeOut);
  const totalSalary = calculateSalary(totalHours, params.hourlyRate);

  const existingRecord = await getAttendanceRecordByShift({
    employeeId: params.employee.id,
    workDate: params.workDate,
    shiftName: params.shiftName,
  });

  if (existingRecord) {
    const { error } = await supabase
      .from('attendance')
      .update({
        check_in: timeIn,
        check_out: timeOut,
        total_hours: totalHours,
        total_salary: totalSalary,
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
      check_in: timeIn,
      check_out: timeOut,
      total_hours: totalHours,
      total_salary: totalSalary,
      status: 'PRESENT',
    },
  ]);

  if (error) throwAttendanceError(error);
}

export async function deleteAttendanceRecord(recordId: number | string): Promise<void> {
  const { error } = await supabase.from('attendance').delete().eq('id', recordId);
  if (error) throwAttendanceError(error);
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

import { supabase } from '@/lib/supabase';
import { calculateHoursFromStrings, calculateSalary } from '@/services/payrollService';
import type { AttendanceRecord, Employee } from '@/lib/types/attendance';

export function getEmployeeHourlyRate(employee: Employee | undefined | null): number {
  return Number(employee?.hourly_rate || employee?.base_salary_per_hour || 30000);
}

export function normalizeTimeValue(value: string | null | undefined): string | null {
  if (!value) return null;

  return value.length === 5 ? `${value}:00` : value;
}

export async function updateAttendanceRecordTime(params: {
  recordId: number;
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

  if (error) throw error;
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

  const { error } = await supabase.from('attendance').upsert(
    {
      employee_id: params.employee.id,
      employee_name: params.employee.full_name,
      work_date: params.workDate,
      shift_name: params.shiftName,
      check_in: timeIn,
      check_out: timeOut,
      total_hours: totalHours,
      total_salary: totalSalary,
      status: 'PRESENT',
    },
    {
      onConflict: 'employee_id,work_date,shift_name',
    }
  );

  if (error) throw error;
}

export async function deleteAttendanceRecord(recordId: number): Promise<void> {
  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('id', recordId);

  if (error) throw error;
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
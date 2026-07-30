export interface Shift {
    id: number | string;
    shift_name: string;
    start_time?: string | null;
    end_time?: string | null;
  }
  
export interface AttendanceRecord {
    id: number | string;
    employee_id: number | string;
    employee_name?: string | null;
    work_date: string;
    shift_name: string;
    check_in?: string | null;
    check_out?: string | null;
    total_hours?: number | string | null;
    total_salary?: number | string | null;
    status?: string | null;
    total_worked_minutes?: number | null;
    calculated_shifts?: number | null;
    adjustment_note?: string | null;
    adjusted_by_employee_id?: number | string | null;
    adjusted_by_name?: string | null;
    cancelled_at?: string | null;
    source?: 'attendance' | 'attendance_logs';
  }
  
  export type ToastType = 'success' | 'error' | 'info';

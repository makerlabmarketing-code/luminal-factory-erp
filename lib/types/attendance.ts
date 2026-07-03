export interface Employee {
    id: number | string;
    full_name: string;
    title?: string | null;
    hourly_rate?: number | string | null;
    base_salary_per_hour?: number | string | null;
  }
  
  export interface Shift {
    id: number | string;
    shift_name: string;
    start_time?: string | null;
    end_time?: string | null;
  }
  
  export interface AttendanceRecord {
    id: number;
    employee_id: number | string;
    employee_name?: string | null;
    work_date: string;
    shift_name: string;
    check_in?: string | null;
    check_out?: string | null;
    total_hours?: number | string | null;
    total_salary?: number | string | null;
    status?: string | null;
  }
  
  export interface SalaryMetadataItem {
    key?: string | null;
    level?: string | null;
    value?: number | string | null;
    rate?: number | string | null;
  }
  
  export interface PayrollSummary {
    totalShifts: number;
    totalHours: number;
    totalWage: number;
  }
  
  export type ToastType = 'success' | 'error' | 'info';
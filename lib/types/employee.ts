export interface Employee {
    id: number | string;
    employee_id?: number | string | null;
    full_name: string;
    email?: string | null;
    title?: string | null;
    status?: string | null;
    qr_token?: string | null;
    branch?: string | null;
    branch_code?: string | null;
    phone?: string | null;
    bank_name?: string | null;
    bank_account_number?: string |null;
    hourly_rate?: number | string | null;
    base_salary_per_hour?: number | string | null;
  }

import type { Employee } from '@/lib/types/employee';
import type { FinancialLedgerEntry } from '@/lib/types/finance';
import {
  formatCurrency,
  getCurrentMonthPeriod,
  parseCurrency,
} from '@/services/financialService';

export { formatCurrency, parseCurrency, getCurrentMonthPeriod };

export async function getStaffExpensesData(params: {
  workerData?: Employee | null;
}): Promise<{
  employee: Employee | null;
  expenses: FinancialLedgerEntry[];
}> {
  const employee = params.workerData || null;

  if (!employee) {
    return {
      employee: null,
      expenses: [],
    };
  }

  const response = await fetch('/api/staff/reimbursements', { credentials: 'include', cache: 'no-store' });
  const payload = await response.json() as { reimbursements?: FinancialLedgerEntry[]; message?: string };
  if (!response.ok) throw new Error(payload.message || 'Không thể tải danh sách hoàn ứng.');

  return {
    employee,
    expenses: payload.reimbursements || [],
  };
}

export async function submitStaffExpense(params: {
  employee: Employee;
  category: string;
  amount: number;
  transactionDate: string;
  description: string;
  projectId?: string;
  payerEmployeeId?: string;
  billUrl: string;
  idempotencyKey: string;
}): Promise<void> {
  const response = await fetch('/api/staff/reimbursements', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: params.amount, transactionDate: params.transactionDate, category: params.category,
      description: params.description, projectId: params.projectId || null,
      beneficiaryEmployeeId: params.employee.id, payerEmployeeId: params.payerEmployeeId || null,
      receiptUrl: params.billUrl, idempotencyKey: params.idempotencyKey,
    }),
  });
  const payload = await response.json() as { message?: string };
  if (!response.ok) throw new Error(payload.message || 'Không thể gửi yêu cầu hoàn ứng.');
}

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
  receiptFile?: File | null;
  idempotencyKey: string;
}): Promise<{
  reimbursementId: string;
  attachmentUploaded: boolean;
  attachmentMessage?: string;
}> {
  const response = await fetch('/api/staff/reimbursements', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: params.amount, transactionDate: params.transactionDate, category: params.category,
      description: params.description, projectId: params.projectId || null,
      beneficiaryEmployeeId: params.employee.id, payerEmployeeId: params.payerEmployeeId || null,
      receiptUrl: null, idempotencyKey: params.idempotencyKey,
    }),
  });
  const payload = await response.json() as { reimbursementId?: string; message?: string };
  if (!response.ok || !payload.reimbursementId) throw new Error(payload.message || 'Không thể gửi yêu cầu hoàn ứng.');

  if (!params.receiptFile) {
    return { reimbursementId: payload.reimbursementId, attachmentUploaded: true };
  }

  const form = new FormData();
  form.append('file', params.receiptFile, params.receiptFile.name);
  const attachmentResponse = await fetch(`/api/staff/reimbursements/${encodeURIComponent(payload.reimbursementId)}/attachments`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  const attachmentPayload = await attachmentResponse.json() as { message?: string };
  if (!attachmentResponse.ok) {
    return {
      reimbursementId: payload.reimbursementId,
      attachmentUploaded: false,
      attachmentMessage: attachmentPayload.message || 'Phiếu đã được tạo nhưng chứng từ chưa tải được.',
    };
  }

  return { reimbursementId: payload.reimbursementId, attachmentUploaded: true };
}

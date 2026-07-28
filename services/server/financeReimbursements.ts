import 'server-only';

import { createClient } from '@/utils/supabase/server';
import { AuthFlowError, hasPermission, requireWorkspaceAccess } from './auth';

export const FINANCE_REIMBURSEMENT_RUNTIME_FLAG = 'FINANCE_REIMBURSEMENT_ENABLED';

function enabled() {
  return process.env[FINANCE_REIMBURSEMENT_RUNTIME_FLAG] === 'true';
}

function unavailable(): never {
  throw new AuthFlowError({ status: 503, code: 'service_unavailable', message: 'Tính năng hoàn ứng chưa được kích hoạt.', failureStage: 'persistence' });
}

function text(value: unknown, label: string, required = true): string | null {
  if (value == null && !required) return null;
  const result = typeof value === 'string' ? value.trim() : '';
  if ((required && !result) || result.length > 500) {
    throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: `${label} không hợp lệ.`, failureStage: 'validation' });
  }
  return result || null;
}

export async function listOwnReimbursements() {
  if (!enabled()) unavailable();
  await requireWorkspaceAccess('STAFF_WORKSPACE');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('list_my_reimbursements');
  if (error) throw new Error('Không thể tải danh sách hoàn ứng.');
  return { success: true as const, reimbursements: data || [] };
}

export async function submitOwnReimbursement(body: Record<string, unknown>) {
  if (!enabled()) unavailable();
  await requireWorkspaceAccess('STAFF_WORKSPACE');
  const amount = Number(body.amount);
  const transactionDate = text(body.transactionDate, 'Ngày chi');
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Số tiền phải lớn hơn 0.', failureStage: 'validation' });
  }
  if (!body.idempotencyKey || typeof body.idempotencyKey !== 'string') {
    throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Mã chống gửi trùng không hợp lệ.', failureStage: 'validation' });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_my_reimbursement', {
    p_amount: amount,
    p_transaction_date: transactionDate,
    p_category: text(body.category, 'Danh mục'),
    p_description: text(body.description, 'Mô tả'),
    p_project_id: body.projectId == null || body.projectId === '' ? null : Number(body.projectId),
    p_beneficiary_employee_id: body.beneficiaryEmployeeId == null ? null : Number(body.beneficiaryEmployeeId),
    p_beneficiary_external_name: text(body.beneficiaryExternalName, 'Người hưởng lợi bên ngoài', false),
    p_payer_employee_id: body.payerEmployeeId == null || body.payerEmployeeId === '' ? null : Number(body.payerEmployeeId),
    p_idempotency_key: body.idempotencyKey,
    p_receipt_url: text(body.receiptUrl, 'Đường dẫn chứng từ', false),
  });
  if (error) {
    if (error.code === '23505') throw new AuthFlowError({ status: 409, code: 'payload_validation_failed', message: 'Yêu cầu này đã được gửi.', failureStage: 'persistence' });
    throw new Error('Không thể gửi yêu cầu hoàn ứng.');
  }
  return { success: true as const, reimbursementId: String(data) };
}

export async function transitionReimbursement(body: Record<string, unknown>) {
  if (!enabled()) unavailable();
  const auth = await requireWorkspaceAccess('ADMIN_WORKSPACE', { allowLegacyAdminFallback: true });
  const status = typeof body.status === 'string' ? body.status : '';
  const permission = status === 'PAID' ? 'FINANCE_PAY' : 'FINANCE_APPROVE';
  if (!(await hasPermission(auth, permission))) {
    throw new AuthFlowError({ status: 403, code: 'permission_forbidden', message: 'Bạn không có quyền duyệt hoặc xác nhận thanh toán.', failureStage: 'permission_check' });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('transition_reimbursement', {
    p_ledger_id: Number(body.ledgerId), p_status: status,
    p_reason: text(body.reason, 'Lý do', false), p_idempotency_key: text(body.idempotencyKey, 'Mã chống gửi trùng'),
  });
  if (error) throw new Error('Không thể cập nhật trạng thái hoàn ứng.');
  return { success: true as const, status: data };
}

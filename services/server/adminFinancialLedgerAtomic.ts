import 'server-only';

import {
  ledgerUpdateRequiresAtomicLink,
  LedgerValidationError,
  validateAdminLedgerMutation,
} from '@/lib/adminFinancialLedger';
import type { AdminLedgerMutationInput } from '@/lib/types/finance';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { AuthFlowError, hasPermission, requireWorkspaceAccess } from './auth';
import { updateAdminFinancialLedger } from './adminFinancialLedger';

type OriginalLedgerRow = {
  id: number | string;
  type: string | null;
  category: string | null;
  requested_by: string | null;
};

function extendedLedgerEnabled() {
  return process.env.FINANCE_REIMBURSEMENT_ENABLED === 'true';
}

function persistenceError(message: string): never {
  throw new AuthFlowError({
    status: 500,
    code: 'payload_validation_failed',
    message,
    failureStage: 'persistence',
  });
}

function notFound(message: string): never {
  throw new AuthFlowError({
    status: 404,
    code: 'payload_validation_failed',
    message,
    failureStage: 'persistence',
  });
}

function conflict(message: string): never {
  throw new AuthFlowError({
    status: 409,
    code: 'payload_validation_failed',
    message,
    failureStage: 'persistence',
  });
}

function validatedMutation(body: Record<string, unknown>): AdminLedgerMutationInput {
  try {
    return validateAdminLedgerMutation(body);
  } catch (error) {
    if (error instanceof LedgerValidationError) {
      throw new AuthFlowError({
        status: 400,
        code: 'payload_validation_failed',
        message: Object.values(error.fieldErrors)[0] || error.message,
        failureStage: 'validation',
        safeDetails: { invalid_field_count: Object.keys(error.fieldErrors).length },
      });
    }
    throw error;
  }
}

async function requireFinanceUpdate() {
  const auth = await requireWorkspaceAccess('ADMIN_WORKSPACE', { allowLegacyAdminFallback: true });
  if (!(await hasPermission(auth, 'FINANCE_UPDATE'))) {
    throw new AuthFlowError({
      status: 403,
      code: 'permission_forbidden',
      message: 'Bạn không có quyền cập nhật giao dịch tài chính.',
      failureStage: 'permission_check',
    });
  }
  return auth;
}

function isManagedCounterRow(row: OriginalLedgerRow): boolean {
  return row.type === 'VON_GOP' && /^\[(Đối ứng|Hủy đối ứng)\]/.test(row.category || '');
}

async function employeeName(employeeId: number | null): Promise<string | null> {
  if (employeeId == null) return null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from('employees').select('full_name').eq('id', employeeId).maybeSingle();
  if (error) persistenceError('Không thể xác minh nhân sự liên quan.');
  if (!data?.full_name?.trim()) notFound('Không tìm thấy Người thực hiện giao dịch đã chọn.');
  return data.full_name.trim();
}

async function resolveRequestedBy(input: AdminLedgerMutationInput, fallback: string | null): Promise<string | null> {
  const payerName = await employeeName(input.payerEmployeeId);
  if (payerName) return payerName;

  if (input.expenseSourceId?.startsWith('SHAREHOLDER:')) {
    const shareholderId = Number(input.expenseSourceId.slice('SHAREHOLDER:'.length));
    if (!Number.isSafeInteger(shareholderId) || shareholderId <= 0) {
      throw new AuthFlowError({
        status: 400,
        code: 'payload_validation_failed',
        message: 'Nguồn chi trả không hợp lệ.',
        failureStage: 'validation',
      });
    }
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('shareholders').select('name, status').eq('id', shareholderId).maybeSingle();
    if (error) persistenceError('Không thể xác minh nguồn chi trả.');
    if (!data?.name?.trim() || data.status !== 'ACTIVE') notFound('Không tìm thấy nguồn chi trả đang hoạt động.');
    return data.name.trim();
  }

  return input.requestedBy || fallback;
}

async function requireExtendedReferences(input: AdminLedgerMutationInput) {
  if (!extendedLedgerEnabled()) return;
  const admin = createSupabaseAdminClient();

  if (input.beneficiaryEmployeeId != null) {
    const { data, error } = await admin.from('employees').select('id').eq('id', input.beneficiaryEmployeeId).maybeSingle();
    if (error) persistenceError('Không thể xác minh Người hưởng lợi.');
    if (!data) notFound('Không tìm thấy Người hưởng lợi đã chọn.');
  }

  if (input.projectId != null) {
    const { data, error } = await admin.from('projects').select('id').eq('id', input.projectId).maybeSingle();
    if (error) persistenceError('Không thể xác minh dự án liên quan.');
    if (!data) notFound('Không tìm thấy dự án liên quan đã chọn.');
  }
}

async function existingLinkCount(original: OriginalLedgerRow): Promise<number> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from('financial_ledger')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'VON_GOP')
    .eq('category', `[Đối ứng] Vốn hiện vật: ${original.category || ''}`);

  query = original.requested_by == null
    ? query.is('requested_by', null)
    : query.eq('requested_by', original.requested_by);

  const { count, error } = await query;
  if (error) persistenceError('Không thể xác minh giao dịch đối ứng.');
  return count || 0;
}

export async function updateAdminFinancialLedgerAtomicAware(
  ledgerId: number,
  body: Record<string, unknown>
) {
  await requireFinanceUpdate();
  const input = validatedMutation(body);
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from('financial_ledger')
    .select('id, type, category, requested_by')
    .eq('id', ledgerId)
    .maybeSingle();
  if (error) persistenceError('Không thể tải giao dịch cần cập nhật.');
  const original = data as OriginalLedgerRow | null;
  if (!original) notFound('Không tìm thấy giao dịch cần cập nhật.');
  if (isManagedCounterRow(original)) conflict('Dòng đối ứng chỉ do hệ thống quản lý.');

  const linkCount = await existingLinkCount(original);
  const shouldHaveLink = input.type === 'CHI_PHI' && Boolean(input.expenseSourceId?.startsWith('SHAREHOLDER:'));
  const needsAtomicLink = ledgerUpdateRequiresAtomicLink({
    hasExistingLink: linkCount > 0,
    type: input.type,
    expenseSourceId: input.expenseSourceId,
  });

  if (!needsAtomicLink) {
    return updateAdminFinancialLedger(ledgerId, body);
  }

  await requireExtendedReferences(input);
  const requestedBy = await resolveRequestedBy(input, original.requested_by);
  const useExtendedColumns = extendedLedgerEnabled();

  const { error: rpcError } = await admin.rpc('update_linked_financial_ledger_entry', {
    p_entry_id: ledgerId,
    p_type: input.type,
    p_sub_type: input.type === 'VON_GOP' ? input.subType : null,
    p_category: input.category,
    p_amount: input.amount,
    p_requested_by: requestedBy,
    p_month_period: input.monthPeriod,
    p_is_paid: input.isPaid,
    p_should_have_link: shouldHaveLink,
    p_update_extended: useExtendedColumns,
    p_transaction_date: input.transactionDate,
    p_description: input.description,
    p_project_id: input.projectId,
    p_beneficiary_employee_id: input.beneficiaryEmployeeId,
    p_beneficiary_external_name: input.beneficiaryExternalName,
    p_payer_employee_id: input.payerEmployeeId,
    p_payment_status: input.isPaid ? 'PAID' : 'UNPAID',
  });

  if (rpcError) {
    if (rpcError.code === '21000') {
      conflict('Giao dịch đang có nhiều dòng đối ứng trùng nhau. Cần xử lý dữ liệu trùng trước khi sửa.');
    }
    if (rpcError.code === '23505') {
      conflict('Đã tồn tại dòng đối ứng cho thông tin mới. Vui lòng kiểm tra lại giao dịch.');
    }
    if (rpcError.code === 'P0002') {
      notFound('Không tìm thấy giao dịch cần cập nhật.');
    }
    console.error('[admin-finance-ledger-atomic-rpc]', { code: rpcError.code || 'unknown' });
    persistenceError('Không thể cập nhật giao dịch và dòng đối ứng một cách nguyên tử.');
  }

  return { success: true as const };
}

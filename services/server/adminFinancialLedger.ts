import 'server-only';

import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import {
  financeAttachmentExtension,
  hasValidFinanceAttachmentSignature,
  ledgerUpdateRequiresAtomicLink,
  LedgerValidationError,
  resolveLedgerPeople,
  validateAdminLedgerMutation,
} from '@/lib/adminFinancialLedger';
import { FINANCE_ATTACHMENT_POLICY, validateFinanceAttachment } from '@/lib/financeExpenseWorkflow';
import type { AdminLedgerMutationInput, FinanceAttachment, FinancialLedgerEntry } from '@/lib/types/finance';
import {
  CAPITAL_CONTRIBUTION_TYPE_METADATA_NAME,
  DEFAULT_CAPITAL_CONTRIBUTION_TYPES,
  DEFAULT_FINANCIAL_TRANSACTION_TYPES,
  FINANCIAL_TRANSACTION_TYPE_METADATA_NAME,
  normalizeSystemMetadataOptions,
} from '@/lib/system-metadata-defaults';
import { AuthFlowError, hasPermission, listGrantedPermissions, requireWorkspaceAccess, type AuthContext } from './auth';

const FINANCE_EVIDENCE_BUCKET = 'finance-evidence';
const ACTIVE_ATTACHMENT_STATES = ['UNVERIFIED', 'VERIFIED'];

function isOwnedAttachmentPath(ledgerId: number | string, bucket: string, path: string): boolean {
  return bucket === FINANCE_EVIDENCE_BUCKET
    && path.startsWith(`${ledgerId}/`)
    && /^[0-9]+\/[0-9a-f]{64}\.(jpg|png|webp|pdf)$/.test(path);
}

function isManagedCounterRow(type: string | null, category: string | null): boolean {
  return type === 'VON_GOP' && /^\[(Đối ứng|Hủy đối ứng)\]/.test(category || '');
}

interface LedgerMutationSnapshot {
  id: number | string;
  type: string | null;
  sub_type: string | null;
  category: string | null;
  amount: number | string | null;
  requested_by: string | null;
  month_period: string | null;
  is_paid: boolean | null;
  [key: string]: unknown;
}

function extendedLedgerEnabled() {
  return process.env.FINANCE_REIMBURSEMENT_ENABLED === 'true';
}

function attachmentWritesEnabled() {
  return process.env.FINANCE_ATTACHMENT_WRITES_ENABLED === 'true';
}

async function requireExtendedLedgerSchema() {
  if (!extendedLedgerEnabled()) return;
  const admin = createSupabaseAdminClient();
  const [{ error: ledgerError }, { error: attachmentError }] = await Promise.all([
    admin
      .from('financial_ledger')
      .select('beneficiary_employee_id, beneficiary_external_name, payer_employee_id, creator_employee_id, payment_status, idempotency_key, transaction_date, description, project_id, updated_at')
      .limit(0),
    admin
      .from('finance_expense_attachments')
      .select('id, financial_ledger_id, storage_bucket, storage_path, original_filename, mime_type, size_bytes, verification_state')
      .limit(0),
  ]);
  if (ledgerError || attachmentError) {
    throw new AuthFlowError({
      status: 503,
      code: 'service_unavailable',
      message: 'Gói dữ liệu sổ thu chi mở rộng chưa sẵn sàng. Vui lòng tắt tính năng và liên hệ quản trị viên.',
      failureStage: 'persistence',
    });
  }
}

async function attachmentStorageReady(): Promise<boolean> {
  if (!extendedLedgerEnabled() || !attachmentWritesEnabled()) return false;
  const admin = createSupabaseAdminClient();
  const { data: bucket, error } = await admin.storage.getBucket(FINANCE_EVIDENCE_BUCKET);
  return !error && bucket.public === false && bucket.file_size_limit === FINANCE_ATTACHMENT_POLICY.maxSizeBytes
    && bucket.allowed_mime_types?.length === FINANCE_ATTACHMENT_POLICY.allowedMimeTypes.length
    && FINANCE_ATTACHMENT_POLICY.allowedMimeTypes.every((mime) => bucket.allowed_mime_types?.includes(mime));
}

async function requireAttachmentStorage() {
  await requireExtendedLedgerSchema();
  if (!(await attachmentStorageReady())) {
    throw new AuthFlowError({
      status: 503,
      code: 'service_unavailable',
      message: 'Kho chứng từ riêng chưa sẵn sàng hoặc chưa bảo đảm chế độ riêng tư.',
      failureStage: 'persistence',
    });
  }
}

async function requireFinance(permission: 'FINANCE_VIEW' | 'FINANCE_CREATE' | 'FINANCE_UPDATE') {
  const auth = await requireWorkspaceAccess('ADMIN_WORKSPACE', { allowLegacyAdminFallback: true });
  if (!(await hasPermission(auth, permission))) {
    throw new AuthFlowError({
      status: 403,
      code: 'permission_forbidden',
      message: 'Bạn không có quyền thực hiện thao tác tài chính này.',
      failureStage: 'permission_check',
    });
  }
  return auth;
}

function persistenceError(message: string): never {
  console.error('[admin-finance-ledger-persistence]', { message });
  throw new AuthFlowError({
    status: 500,
    code: 'payload_validation_failed',
    message,
    failureStage: 'persistence',
  });
}

function resourceNotFound(message: string): never {
  throw new AuthFlowError({
    status: 404,
    code: 'payload_validation_failed',
    message,
    failureStage: 'persistence',
  });
}

function resourceConflict(message: string): never {
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

function mutationColumns(
  input: ReturnType<typeof validateAdminLedgerMutation>,
  auth: AuthContext,
  mode: 'create' | 'update'
) {
  const base = {
    type: input.type,
    sub_type: input.type === 'VON_GOP' ? input.subType : null,
    category: input.category,
    amount: input.amount,
    requested_by: input.requestedBy,
    month_period: input.monthPeriod,
    is_paid: input.isPaid,
  };

  if (!extendedLedgerEnabled()) return base;
  const extended = {
    ...base,
    transaction_date: input.transactionDate,
    description: input.description,
    project_id: input.projectId,
    beneficiary_employee_id: input.beneficiaryEmployeeId,
    beneficiary_external_name: input.beneficiaryExternalName,
    payer_employee_id: input.payerEmployeeId,
    payment_status: input.isPaid ? 'PAID' : 'UNPAID',
    updated_at: new Date().toISOString(),
  };
  return mode === 'create'
    ? { ...extended, creator_employee_id: Number(auth.employee.id), idempotency_key: input.idempotencyKey }
    : extended;
}

async function employeeName(employeeId: number | string | null | undefined): Promise<string | null> {
  if (employeeId == null) return null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from('employees').select('full_name').eq('id', employeeId).maybeSingle();
  if (error) persistenceError('Không thể xác minh nhân sự liên quan.');
  if (!data?.full_name?.trim()) resourceNotFound('Không tìm thấy Người thực hiện giao dịch đã chọn.');
  return data.full_name.trim();
}

async function requestedByForMutation(
  input: AdminLedgerMutationInput,
  fallback: string | null = null
): Promise<string | null> {
  const payerName = await employeeName(input.payerEmployeeId);
  if (payerName) return payerName;
  if (input.expenseSourceId?.startsWith('SHAREHOLDER:')) {
    const shareholderId = Number(input.expenseSourceId.slice('SHAREHOLDER:'.length));
    if (!Number.isSafeInteger(shareholderId) || shareholderId <= 0) {
      throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Nguồn chi trả không hợp lệ.', failureStage: 'validation' });
    }
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('shareholders').select('name, status').eq('id', shareholderId).maybeSingle();
    if (error) persistenceError('Không thể xác minh nguồn chi trả.');
    if (!data?.name?.trim() || data.status !== 'ACTIVE') resourceNotFound('Không tìm thấy nguồn chi trả đang hoạt động.');
    return data.name.trim();
  }
  return input.requestedBy || fallback;
}

async function requireMutationReferences(input: AdminLedgerMutationInput) {
  if (!extendedLedgerEnabled()) return;
  const admin = createSupabaseAdminClient();
  if (input.beneficiaryEmployeeId != null) {
    const { data, error } = await admin.from('employees').select('id').eq('id', input.beneficiaryEmployeeId).maybeSingle();
    if (error) persistenceError('Không thể xác minh Người hưởng lợi.');
    if (!data) resourceNotFound('Không tìm thấy Người hưởng lợi đã chọn.');
  }
  if (input.projectId != null) {
    const { data, error } = await admin.from('projects').select('id').eq('id', input.projectId).maybeSingle();
    if (error) persistenceError('Không thể xác minh dự án liên quan.');
    if (!data) resourceNotFound('Không tìm thấy dự án liên quan đã chọn.');
  }
}

async function attachmentDtos(ledgerIds: Array<number | string>): Promise<Map<string, FinanceAttachment[]>> {
  const result = new Map<string, FinanceAttachment[]>();
  if (!extendedLedgerEnabled() || ledgerIds.length === 0) return result;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('finance_expense_attachments')
    .select('id, financial_ledger_id, storage_bucket, storage_path, original_filename, mime_type, size_bytes, verification_state')
    .in('financial_ledger_id', ledgerIds)
    .in('verification_state', ACTIVE_ATTACHMENT_STATES)
    .order('id', { ascending: true });
  if (error) persistenceError('Không thể tải chứng từ giao dịch.');

  const signedAttachments = await Promise.all((data || []).map(async (row) => {
    const pathIsOwned = isOwnedAttachmentPath(row.financial_ledger_id, row.storage_bucket, row.storage_path);
    const signedResult = pathIsOwned
      ? await admin.storage.from(FINANCE_EVIDENCE_BUCKET).createSignedUrl(row.storage_path, 300)
      : { data: null, error: new Error('invalid attachment ownership path') };
    if (signedResult.error) console.warn('[finance-attachment-signed-url]', { attachmentId: row.id, ledgerId: row.financial_ledger_id, invalidPath: !pathIsOwned });
    return {
      ledgerId: String(row.financial_ledger_id),
      attachment: {
      id: row.id,
      originalFilename: row.original_filename,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
      signedUrl: signedResult.error ? null : signedResult.data.signedUrl,
      verificationState: row.verification_state,
      } satisfies FinanceAttachment,
    };
  }));

  for (const { ledgerId, attachment } of signedAttachments) {
    result.set(ledgerId, [...(result.get(ledgerId) || []), attachment]);
  }
  return result;
}

export async function listAdminFinancialLedger(monthPeriod: string) {
  const startedAt = performance.now();
  const auth = await requireWorkspaceAccess('ADMIN_WORKSPACE', { allowLegacyAdminFallback: true });
  const grantedPermissions = await listGrantedPermissions(auth, [
    'FINANCE_VIEW',
    'FINANCE_APPROVE',
    'FINANCE_PAY',
  ]);
  if (!grantedPermissions.ok) {
    throw new AuthFlowError({
      status: 500,
      code: 'admin_verification_failed',
      message: 'Không thể xác minh quyền tài chính. Vui lòng thử lại.',
      failureStage: 'permission_check',
      safeDetails: grantedPermissions.safeDetails,
    });
  }
  if (!grantedPermissions.permissionCodes.includes('FINANCE_VIEW')) {
    throw new AuthFlowError({ status: 403, code: 'permission_forbidden', message: 'Bạn không có quyền xem sổ thu chi.', failureStage: 'permission_check' });
  }
  if (!/^(0[1-9]|1[0-2])\/\d{4}$/.test(monthPeriod)) {
    throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Kỳ báo cáo không hợp lệ.', failureStage: 'validation' });
  }
  const admin = createSupabaseAdminClient();
  const baseColumns = 'id, type, sub_type, category, amount, bill_url, requested_by, is_paid, month_period, created_at';
  const extendedColumns = ', updated_at, transaction_date, description, project_id, beneficiary_employee_id, beneficiary_external_name, payer_employee_id, reimbursement_requester_employee_id, reimbursement_status, rejection_reason, source_type, source_reference';
  const { data, error } = await admin
    .from('financial_ledger')
    .select(baseColumns + (extendedLedgerEnabled() ? extendedColumns : ''))
    .eq('month_period', monthPeriod)
    .order('id', { ascending: false });
  if (error) persistenceError('Không tải được sổ thu chi.');

  const rows = (data || []) as unknown as FinancialLedgerEntry[];
  const financeMetadataPromise = (async () => {
    let query = admin
      .from('system_metadata')
      .select('name, data')
      .in('name', [FINANCIAL_TRANSACTION_TYPE_METADATA_NAME, CAPITAL_CONTRIBUTION_TYPE_METADATA_NAME]);
    if (process.env.SYSTEM_RECORD_LIFECYCLE_ENABLED === 'true') query = query.eq('is_active', true);
    const { data: metadataRows, error: metadataError } = await query;
    if (metadataError) persistenceError('Không tải được danh mục tài chính.');
    const metadata = new Map((metadataRows || []).map((row) => [row.name, row.data]));
    return {
      transactionTypes: normalizeSystemMetadataOptions(
        metadata.get(FINANCIAL_TRANSACTION_TYPE_METADATA_NAME),
        DEFAULT_FINANCIAL_TRANSACTION_TYPES,
      ),
      contributionTypes: normalizeSystemMetadataOptions(
        metadata.get(CAPITAL_CONTRIBUTION_TYPE_METADATA_NAME),
        DEFAULT_CAPITAL_CONTRIBUTION_TYPES,
      ),
    };
  })();
  const employeeIds = Array.from(new Set(rows.flatMap((row) => [row.beneficiary_employee_id, row.payer_employee_id]).filter((id): id is number | string => id != null)));
  const employeeNamesPromise = (async () => {
    const employeeNames = new Map<string, string>();
    if (employeeIds.length === 0) return employeeNames;
    const { data: employees, error: employeeError } = await admin.from('employees').select('id, full_name').in('id', employeeIds);
    if (employeeError) persistenceError('Không thể tải người liên quan.');
    for (const employee of employees || []) employeeNames.set(String(employee.id), employee.full_name);
    return employeeNames;
  })();
  const projectsPromise = (async () => {
    if (!extendedLedgerEnabled()) return [] as Array<{ id: number | string; name: string }>;
    const { data: projectRows, error: projectError } = await admin
      .from('projects')
      .select('id, project_name')
      .order('project_name', { ascending: true });
    if (projectError) {
      console.warn('[admin-finance-project-options]', {
        message: 'Không thể tải danh sách dự án liên quan.',
        code: projectError.code,
      });
      return [] as Array<{ id: number | string; name: string }>;
    }
    return (projectRows || []).flatMap((project) => {
      const name = project.project_name?.trim();
      return name ? [{ id: project.id, name }] : [];
    });
  })();
  const [employeeNames, attachments, projects, financeMetadata] = await Promise.all([
    employeeNamesPromise,
    attachmentDtos(rows.map((row) => row.id)),
    projectsPromise,
    financeMetadataPromise,
  ]);

  console.info('[admin-finance-ledger-read]', {
    durationMs: Math.round(performance.now() - startedAt),
    rowCount: rows.length,
    attachmentCount: Array.from(attachments.values()).reduce((total, entries) => total + entries.length, 0),
  });

  return {
    success: true as const,
    companyBankCode: process.env.COMPANY_BANK_CODE || 'MB',
    companyBankAccount: process.env.COMPANY_BANK_ACCOUNT || '',
    transactionTypes: financeMetadata.transactionTypes,
    contributionTypes: financeMetadata.contributionTypes,
    extendedSchemaEnabled: extendedLedgerEnabled(),
    attachmentsEnabled: extendedLedgerEnabled() && attachmentWritesEnabled(),
    projects,
    reimbursementCapabilities: {
      currentEmployeeId: String(auth.employee.id),
      canApprove: grantedPermissions.permissionCodes.includes('FINANCE_APPROVE'),
      canPay: grantedPermissions.permissionCodes.includes('FINANCE_PAY'),
    },
    ledger: rows.map((row) => ({
      ...resolveLedgerPeople(row, employeeNames),
      attachments: attachments.get(String(row.id)) || (row.bill_url ? [{ id: `legacy:${row.id}`, originalFilename: 'Chứng từ cũ', mimeType: 'application/octet-stream', sizeBytes: 0, legacyUrl: row.bill_url }] : []),
    })),
  };
}

export async function createAdminFinancialLedger(body: Record<string, unknown>) {
  const auth = await requireFinance('FINANCE_CREATE');
  await requireExtendedLedgerSchema();
  let input = validatedMutation(body);
  if (extendedLedgerEnabled() && !input.idempotencyKey) {
    throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Thiếu mã chống ghi trùng của giao dịch.', failureStage: 'validation' });
  }
  await requireMutationReferences(input);
  const requestedBy = await requestedByForMutation(input);
  input = { ...input, requestedBy };
  const admin = createSupabaseAdminClient();
  const primary = mutationColumns(input, auth, 'create');
  const isSelfPaidExpense = input.type === 'CHI_PHI' && input.expenseSourceId?.startsWith('SHAREHOLDER:');
  const rows = isSelfPaidExpense
    ? [primary, { type: 'VON_GOP', sub_type: 'HIEN_VAT', category: `[Đối ứng] Vốn hiện vật: ${input.category}`, amount: input.amount, requested_by: requestedBy, month_period: input.monthPeriod, is_paid: true }]
    : [primary];
  const { data, error } = await admin.from('financial_ledger').insert(rows).select('id, type, category');
  if (error) {
    if (error.code === '23505') throw new AuthFlowError({ status: 409, code: 'payload_validation_failed', message: 'Giao dịch này đã được ghi trước đó.', failureStage: 'persistence' });
    persistenceError('Không thể ghi sổ giao dịch.');
  }
  const created = (data || []).find((row) => row.type === input.type && row.category === input.category) || data?.[0];
  return { success: true as const, ledgerId: created?.id };
}

export async function updateAdminFinancialLedger(ledgerId: number, body: Record<string, unknown>) {
  const auth = await requireFinance('FINANCE_UPDATE');
  await requireExtendedLedgerSchema();
  const input = validatedMutation(body);
  await requireMutationReferences(input);
  const admin = createSupabaseAdminClient();
  const extendedOriginalColumns = extendedLedgerEnabled() ? ', transaction_date, description, project_id, beneficiary_employee_id, beneficiary_external_name, payer_employee_id, creator_employee_id, payment_status, idempotency_key, updated_at' : '';
  const { data: originalData, error: originalError } = await admin.from('financial_ledger').select(`id, type, sub_type, category, amount, requested_by, month_period, is_paid${extendedOriginalColumns}`).eq('id', ledgerId).maybeSingle();
  const original = originalData as unknown as LedgerMutationSnapshot | null;
  if (originalError) persistenceError('Không thể tải giao dịch cần cập nhật.');
  if (!original) resourceNotFound('Không tìm thấy giao dịch cần cập nhật.');
  if (original.type === 'HOAN_UNG') resourceConflict('Phiếu hoàn ứng chỉ được thay đổi bằng thao tác duyệt, từ chối hoặc xác nhận thanh toán.');
  if (isManagedCounterRow(original.type, original.category)) resourceConflict('Dòng đối ứng chỉ do hệ thống quản lý.');
  const requestedBy = await requestedByForMutation(input, original.requested_by);
  const nextInput = { ...input, requestedBy };
  const originalLinkedCategory = `[Đối ứng] Vốn hiện vật: ${original.category}`;
  const { data: oldLink, error: linkLookupError } = await admin.from('financial_ledger').select('id').eq('type', 'VON_GOP').eq('category', originalLinkedCategory).eq('requested_by', original.requested_by).maybeSingle();
  if (linkLookupError) persistenceError('Không thể xác minh giao dịch đối ứng.');

  if (ledgerUpdateRequiresAtomicLink({
    hasExistingLink: Boolean(oldLink),
    type: nextInput.type,
    expenseSourceId: nextInput.expenseSourceId,
  })) {
    throw new AuthFlowError({
      status: 503,
      code: 'service_unavailable',
      message: 'Giao dịch có dòng đối ứng chỉ được sửa sau khi xử lý nguyên tử được kích hoạt.',
      failureStage: 'persistence',
    });
  }

  const { data: updated, error: primaryError } = await admin
    .from('financial_ledger')
    .update(mutationColumns(nextInput, auth, 'update'))
    .eq('id', ledgerId)
    .select('id')
    .maybeSingle();
  if (primaryError) persistenceError('Không thể cập nhật giao dịch.');
  if (!updated) resourceNotFound('Không tìm thấy giao dịch cần cập nhật.');
  return { success: true as const };
}

export async function setAdminFinancialLedgerPaid(ledgerId: number, isPaid: boolean) {
  await requireFinance('FINANCE_UPDATE');
  await requireExtendedLedgerSchema();
  const admin = createSupabaseAdminClient();
  const { data: target, error: targetError } = await admin.from('financial_ledger').select('id, type, category').eq('id', ledgerId).maybeSingle();
  if (targetError) persistenceError('Không thể tải giao dịch cần cập nhật trạng thái.');
  if (!target) resourceNotFound('Không tìm thấy giao dịch cần cập nhật trạng thái.');
  if (target.type === 'HOAN_UNG') resourceConflict('Phiếu hoàn ứng chỉ được xác nhận thanh toán qua quy trình hoàn ứng.');
  if (isManagedCounterRow(target.type, target.category)) resourceConflict('Dòng đối ứng chỉ do hệ thống quản lý.');
  const values = extendedLedgerEnabled() ? { is_paid: isPaid, payment_status: isPaid ? 'PAID' : 'UNPAID', updated_at: new Date().toISOString() } : { is_paid: isPaid };
  const { data, error } = await admin.from('financial_ledger').update(values).eq('id', ledgerId).select('id').maybeSingle();
  if (error) persistenceError('Không thể cập nhật trạng thái thanh toán.');
  if (!data) resourceNotFound('Không tìm thấy giao dịch cần cập nhật trạng thái.');
  return { success: true as const };
}

async function requireLedgerResource(ledgerId: number) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from('financial_ledger').select('id').eq('id', ledgerId).maybeSingle();
  if (error) persistenceError('Không thể xác minh giao dịch của chứng từ.');
  if (!data) resourceNotFound('Không tìm thấy giao dịch của chứng từ.');
}

async function storeAttachment(
  ledgerId: number,
  file: File,
  uploadedByEmployeeId: number | string,
  options: { allowReplacementAtLimit?: boolean; replacementAttachmentId?: number } = {}
) {
  await requireAttachmentStorage();
  await requireLedgerResource(ledgerId);
  const validation = validateFinanceAttachment(file);
  if (validation) throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: validation, failureStage: 'validation' });
  if (!(await hasValidFinanceAttachmentSignature(file))) {
    throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Nội dung chứng từ không khớp với loại tệp đã chọn.', failureStage: 'validation' });
  }
  const admin = createSupabaseAdminClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const fingerprint = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const path = `${ledgerId}/${fingerprint}.${financeAttachmentExtension(file)}`;
  const { data: duplicate, error: duplicateError } = await admin
    .from('finance_expense_attachments')
    .select('id')
    .eq('financial_ledger_id', ledgerId)
    .eq('storage_path', path)
    .in('verification_state', ACTIVE_ATTACHMENT_STATES)
    .maybeSingle();
  if (duplicateError) persistenceError('Không thể kiểm tra chứng từ trùng lặp.');
  if (duplicate) {
    if (options.replacementAttachmentId != null) resourceConflict('Chứng từ thay thế trùng với một chứng từ đang lưu.');
    return { id: duplicate.id, storageBucket: FINANCE_EVIDENCE_BUCKET, storagePath: path, alreadyStored: true as const };
  }
  const { count, error: countError } = await admin.from('finance_expense_attachments').select('id', { count: 'exact', head: true }).eq('financial_ledger_id', ledgerId).in('verification_state', ACTIVE_ATTACHMENT_STATES);
  if (countError) persistenceError('Không thể kiểm tra số lượng chứng từ.');
  if ((count || 0) >= FINANCE_ATTACHMENT_POLICY.maxCount && !options.allowReplacementAtLimit) {
    throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: `Mỗi giao dịch tối đa ${FINANCE_ATTACHMENT_POLICY.maxCount} chứng từ.`, failureStage: 'validation' });
  }
  const { error: uploadError } = await admin.storage.from(FINANCE_EVIDENCE_BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) {
    const { data: retried } = await admin
      .from('finance_expense_attachments')
      .select('id')
      .eq('financial_ledger_id', ledgerId)
      .eq('storage_path', path)
      .in('verification_state', ACTIVE_ATTACHMENT_STATES)
      .maybeSingle();
    if (retried && options.replacementAttachmentId == null) {
      return { id: retried.id, storageBucket: FINANCE_EVIDENCE_BUCKET, storagePath: path, alreadyStored: true as const };
    }
    resourceConflict('Chứng từ đang được tải lên hoặc đã tồn tại. Vui lòng thử lại.');
  }
  const { data: metadata, error: metadataError } = await admin.from('finance_expense_attachments').insert({
    financial_ledger_id: ledgerId,
    uploaded_by_employee_id: Number(uploadedByEmployeeId),
    attachment_type: file.type.startsWith('image/') ? 'RECEIPT_IMAGE' : 'DOCUMENT',
    storage_bucket: FINANCE_EVIDENCE_BUCKET,
    storage_path: path,
    original_filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    verification_state: 'UNVERIFIED',
  }).select('id').single();
  if (metadataError) {
    await admin.storage.from(FINANCE_EVIDENCE_BUCKET).remove([path]);
    persistenceError('Không thể liên kết chứng từ với giao dịch.');
  }
  return { id: metadata.id, storageBucket: FINANCE_EVIDENCE_BUCKET, storagePath: path, alreadyStored: false as const };
}

export async function uploadAdminLedgerAttachment(ledgerId: number, file: File) {
  const auth = await requireFinance('FINANCE_UPDATE');
  const metadata = await storeAttachment(ledgerId, file, auth.employee.id);
  return { success: true as const, attachmentId: metadata.id };
}

export async function removeAdminLedgerAttachment(ledgerId: number, attachmentId: number) {
  await requireFinance('FINANCE_UPDATE');
  await requireAttachmentStorage();
  await requireLedgerResource(ledgerId);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from('finance_expense_attachments').select('storage_bucket, storage_path').eq('id', attachmentId).eq('financial_ledger_id', ledgerId).in('verification_state', ACTIVE_ATTACHMENT_STATES).maybeSingle();
  if (error) persistenceError('Không thể tải chứng từ cần gỡ.');
  if (!data) resourceNotFound('Không tìm thấy chứng từ cần gỡ.');
  if (!isOwnedAttachmentPath(ledgerId, data.storage_bucket, data.storage_path)) resourceConflict('Đường dẫn chứng từ không thuộc giao dịch này.');
  const { data: archived, error: archiveError } = await admin.from('finance_expense_attachments').update({ verification_state: 'REMOVED' }).eq('id', attachmentId).eq('financial_ledger_id', ledgerId).in('verification_state', ACTIVE_ATTACHMENT_STATES).select('id').maybeSingle();
  if (archiveError) persistenceError('Không thể gỡ chứng từ khỏi giao dịch.');
  if (!archived) resourceConflict('Chứng từ đã được thay đổi bởi một yêu cầu khác.');
  const { error: storageError } = await admin.storage.from(data.storage_bucket).remove([data.storage_path]);
  return storageError
    ? { success: false as const, cleanupPending: true as const }
    : { success: true as const, cleanupPending: false as const };
}

export async function replaceAdminLedgerAttachment(ledgerId: number, attachmentId: number, file: File) {
  const auth = await requireFinance('FINANCE_UPDATE');
  await requireAttachmentStorage();
  await requireLedgerResource(ledgerId);
  const admin = createSupabaseAdminClient();
  const { data: old, error: oldError } = await admin.from('finance_expense_attachments').select('storage_bucket, storage_path').eq('id', attachmentId).eq('financial_ledger_id', ledgerId).in('verification_state', ACTIVE_ATTACHMENT_STATES).maybeSingle();
  if (oldError) persistenceError('Không thể tải chứng từ cần thay thế.');
  if (!old) resourceNotFound('Không tìm thấy chứng từ cần thay thế.');
  if (!isOwnedAttachmentPath(ledgerId, old.storage_bucket, old.storage_path)) resourceConflict('Đường dẫn chứng từ không thuộc giao dịch này.');
  const created = await storeAttachment(ledgerId, file, auth.employee.id, { allowReplacementAtLimit: true, replacementAttachmentId: attachmentId });
  const { data: replaced, error: replaceError } = await admin.from('finance_expense_attachments').update({ verification_state: 'REPLACED' }).eq('id', attachmentId).eq('financial_ledger_id', ledgerId).in('verification_state', ACTIVE_ATTACHMENT_STATES).select('id').maybeSingle();
  if (replaceError) {
    await admin.from('finance_expense_attachments').update({ verification_state: 'ORPHANED' }).eq('id', created.id);
    await admin.storage.from(created.storageBucket).remove([created.storagePath]);
    persistenceError('Không thể thay thế chứng từ an toàn.');
  }
  if (!replaced) {
    await admin.from('finance_expense_attachments').update({ verification_state: 'ORPHANED' }).eq('id', created.id);
    await admin.storage.from(created.storageBucket).remove([created.storagePath]);
    resourceConflict('Chứng từ đã được thay đổi bởi một yêu cầu khác.');
  }
  const { error: storageError } = await admin.storage.from(old.storage_bucket).remove([old.storage_path]);
  return storageError
    ? { success: false as const, attachmentId: created.id, cleanupPending: true as const }
    : { success: true as const, attachmentId: created.id, cleanupPending: false as const };
}

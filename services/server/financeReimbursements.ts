import 'server-only';

import { financeAttachmentExtension, hasValidFinanceAttachmentSignature } from '@/lib/adminFinancialLedger';
import { FINANCE_ATTACHMENT_POLICY, validateFinanceAttachment } from '@/lib/financeExpenseWorkflow';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { AuthFlowError, hasPermission, requireWorkspaceAccess } from './auth';

export const FINANCE_REIMBURSEMENT_RUNTIME_FLAG = 'FINANCE_REIMBURSEMENT_ENABLED';
export const FINANCE_ATTACHMENT_WRITES_RUNTIME_FLAG = 'FINANCE_ATTACHMENT_WRITES_ENABLED';
const FINANCE_EVIDENCE_BUCKET = 'finance-evidence';
const ACTIVE_ATTACHMENT_STATES = ['UNVERIFIED', 'VERIFIED'];

function enabled() {
  return process.env[FINANCE_REIMBURSEMENT_RUNTIME_FLAG] === 'true';
}

function attachmentWritesEnabled() {
  return process.env[FINANCE_ATTACHMENT_WRITES_RUNTIME_FLAG] === 'true';
}

function unavailable(): never {
  throw new AuthFlowError({ status: 503, code: 'service_unavailable', message: 'Tính năng hoàn ứng chưa được kích hoạt.', failureStage: 'persistence' });
}

function attachmentUnavailable(): never {
  throw new AuthFlowError({ status: 503, code: 'service_unavailable', message: 'Tải chứng từ hoàn ứng chưa được kích hoạt.', failureStage: 'persistence' });
}

function text(value: unknown, label: string, required = true): string | null {
  if (value == null && !required) return null;
  const result = typeof value === 'string' ? value.trim() : '';
  if ((required && !result) || result.length > 500) {
    throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: `${label} không hợp lệ.`, failureStage: 'validation' });
  }
  return result || null;
}

async function requireAttachmentBucket() {
  if (!attachmentWritesEnabled()) attachmentUnavailable();
  const admin = createSupabaseAdminClient();
  const { data: bucket, error } = await admin.storage.getBucket(FINANCE_EVIDENCE_BUCKET);
  if (
    error
    || !bucket
    || bucket.public !== false
    || bucket.file_size_limit !== FINANCE_ATTACHMENT_POLICY.maxSizeBytes
    || bucket.allowed_mime_types?.length !== FINANCE_ATTACHMENT_POLICY.allowedMimeTypes.length
    || !FINANCE_ATTACHMENT_POLICY.allowedMimeTypes.every((mime) => bucket.allowed_mime_types?.includes(mime))
  ) {
    throw new AuthFlowError({ status: 503, code: 'service_unavailable', message: 'Kho chứng từ riêng chưa sẵn sàng.', failureStage: 'persistence' });
  }
}

export async function listOwnReimbursements() {
  await requireWorkspaceAccess('STAFF_WORKSPACE');
  if (!enabled()) unavailable();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('list_my_reimbursements');
  if (error) throw new Error('Không thể tải danh sách hoàn ứng.');

  const reimbursements = (data || []) as Array<Record<string, unknown> & { id: number | string; bill_url?: string | null }>;
  const ids = reimbursements.map((row) => row.id);
  if (ids.length === 0) return { success: true as const, reimbursements };

  const admin = createSupabaseAdminClient();
  const { data: attachments, error: attachmentError } = await admin
    .from('finance_expense_attachments')
    .select('id, financial_ledger_id, storage_bucket, storage_path')
    .in('financial_ledger_id', ids)
    .in('verification_state', ACTIVE_ATTACHMENT_STATES)
    .order('id', { ascending: true });

  if (attachmentError) throw new Error('Không thể tải chứng từ hoàn ứng.');
  const signedByLedger = new Map<string, string>();
  for (const attachment of attachments || []) {
    const ledgerId = String(attachment.financial_ledger_id);
    if (signedByLedger.has(ledgerId)) continue;
    if (attachment.storage_bucket !== FINANCE_EVIDENCE_BUCKET || !attachment.storage_path.startsWith(`${ledgerId}/`)) continue;
    const { data: signed, error: signedError } = await admin.storage
      .from(FINANCE_EVIDENCE_BUCKET)
      .createSignedUrl(attachment.storage_path, 300);
    if (!signedError && signed?.signedUrl) signedByLedger.set(ledgerId, signed.signedUrl);
  }

  return {
    success: true as const,
    reimbursements: reimbursements.map((row) => ({
      ...row,
      bill_url: signedByLedger.get(String(row.id)) || row.bill_url || null,
    })),
  };
}

export async function submitOwnReimbursement(body: Record<string, unknown>) {
  await requireWorkspaceAccess('STAFF_WORKSPACE');
  if (!enabled()) unavailable();
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
    p_receipt_url: null,
  });
  if (error) {
    if (error.code === '23505') throw new AuthFlowError({ status: 409, code: 'payload_validation_failed', message: 'Yêu cầu này đã được gửi.', failureStage: 'persistence' });
    throw new Error('Không thể gửi yêu cầu hoàn ứng.');
  }
  return { success: true as const, reimbursementId: String(data) };
}

export async function uploadOwnReimbursementAttachment(ledgerId: number, file: File) {
  const auth = await requireWorkspaceAccess('STAFF_WORKSPACE');
  if (!enabled()) unavailable();
  await requireAttachmentBucket();

  const validation = validateFinanceAttachment(file);
  if (validation) throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: validation, failureStage: 'validation' });
  if (!(await hasValidFinanceAttachmentSignature(file))) {
    throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Nội dung chứng từ không khớp với loại tệp đã chọn.', failureStage: 'validation' });
  }

  const admin = createSupabaseAdminClient();
  const { data: ledger, error: ledgerError } = await admin
    .from('financial_ledger')
    .select('id, reimbursement_status, reimbursement_requester_employee_id, beneficiary_employee_id')
    .eq('id', ledgerId)
    .eq('type', 'HOAN_UNG')
    .maybeSingle();
  if (ledgerError) throw new Error('Không thể xác minh phiếu hoàn ứng.');
  if (!ledger) throw new AuthFlowError({ status: 404, code: 'payload_validation_failed', message: 'Không tìm thấy phiếu hoàn ứng.', failureStage: 'persistence' });
  const actorId = String(auth.employee.id);
  if (String(ledger.reimbursement_requester_employee_id) !== actorId && String(ledger.beneficiary_employee_id) !== actorId) {
    throw new AuthFlowError({ status: 403, code: 'permission_forbidden', message: 'Bạn không có quyền thêm chứng từ cho phiếu này.', failureStage: 'permission_check' });
  }
  if (ledger.reimbursement_status !== 'SUBMITTED') {
    throw new AuthFlowError({ status: 409, code: 'payload_validation_failed', message: 'Chỉ phiếu đang chờ duyệt mới được bổ sung chứng từ.', failureStage: 'persistence' });
  }

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
  if (duplicateError) throw new Error('Không thể kiểm tra chứng từ trùng lặp.');
  if (duplicate) return { success: true as const, attachmentId: duplicate.id, alreadyStored: true as const };

  const { count, error: countError } = await admin
    .from('finance_expense_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('financial_ledger_id', ledgerId)
    .in('verification_state', ACTIVE_ATTACHMENT_STATES);
  if (countError) throw new Error('Không thể kiểm tra số lượng chứng từ.');
  if ((count || 0) >= FINANCE_ATTACHMENT_POLICY.maxCount) {
    throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: `Mỗi phiếu tối đa ${FINANCE_ATTACHMENT_POLICY.maxCount} chứng từ.`, failureStage: 'validation' });
  }

  const { error: uploadError } = await admin.storage.from(FINANCE_EVIDENCE_BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) throw new AuthFlowError({ status: 409, code: 'payload_validation_failed', message: 'Chứng từ đang được tải lên hoặc đã tồn tại.', failureStage: 'persistence' });

  const { data: metadata, error: metadataError } = await admin.from('finance_expense_attachments').insert({
    financial_ledger_id: ledgerId,
    uploaded_by_employee_id: Number(auth.employee.id),
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
    throw new Error('Không thể liên kết chứng từ với phiếu hoàn ứng.');
  }

  return { success: true as const, attachmentId: metadata.id, alreadyStored: false as const };
}

export async function transitionReimbursement(body: Record<string, unknown>) {
  const auth = await requireWorkspaceAccess('ADMIN_WORKSPACE', { allowLegacyAdminFallback: true });
  const status = typeof body.status === 'string' ? body.status : '';
  if (!['APPROVED', 'REJECTED', 'PAID'].includes(status)) {
    throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Trạng thái hoàn ứng không hợp lệ.', failureStage: 'validation' });
  }
  const ledgerId = Number(body.ledgerId);
  if (!Number.isSafeInteger(ledgerId) || ledgerId <= 0) {
    throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Phiếu hoàn ứng không hợp lệ.', failureStage: 'validation' });
  }
  const reason = text(body.reason, 'Lý do', false);
  if (status === 'REJECTED' && (!reason || reason.length < 3)) {
    throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Lý do từ chối phải có ít nhất 3 ký tự.', failureStage: 'validation' });
  }
  const permission = status === 'PAID' ? 'FINANCE_PAY' : 'FINANCE_APPROVE';
  if (!(await hasPermission(auth, permission))) {
    throw new AuthFlowError({ status: 403, code: 'permission_forbidden', message: 'Bạn không có quyền duyệt hoặc xác nhận thanh toán.', failureStage: 'permission_check' });
  }
  if (!enabled()) unavailable();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('transition_reimbursement', {
    p_ledger_id: ledgerId, p_status: status,
    p_reason: reason, p_idempotency_key: text(body.idempotencyKey, 'Mã chống gửi trùng'),
  });
  if (error) {
    if (error.code === '42501') {
      throw new AuthFlowError({ status: 403, code: 'permission_forbidden', message: 'Bạn không đủ quyền hoặc không thể tự duyệt phiếu của chính mình.', failureStage: 'permission_check' });
    }
    if (error.code === '23505') {
      throw new AuthFlowError({ status: 409, code: 'payload_validation_failed', message: 'Thao tác này đã được xử lý trước đó.', failureStage: 'persistence' });
    }
    throw new AuthFlowError({ status: 409, code: 'payload_validation_failed', message: 'Phiếu đã đổi trạng thái hoặc không còn phù hợp với thao tác này.', failureStage: 'persistence' });
  }
  return { success: true as const, status: data };
}

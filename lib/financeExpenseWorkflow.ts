export const MISSING_EMPLOYEE_PAYMENT_INFO_MESSAGE = 'Nhân sự chưa có thông tin nhận tiền.';

export type FinanceExpenseCategory =
  | 'salary'
  | 'operating_expense'
  | 'material_purchase'
  | 'project_expense'
  | 'personal_advance'
  | 'reimbursement'
  | 'supplier_payment'
  | 'other_approved_expense';

export type ReimbursementRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PAID'
  | 'CANCELLED';

export interface EmployeePaymentProfile {
  employeeId: string | number;
  fullName: string;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  accountHolderName?: string | null;
  paymentNoteTemplate?: string | null;
}

export interface FinanceRoleDraft {
  category: FinanceExpenseCategory;
  beneficiaryEmployeeId?: string | number | null;
  beneficiaryExternalName?: string | null;
  payerEmployeeId?: string | number | null;
  requesterEmployeeId?: string | number | null;
  reimbursementRecipientEmployeeId?: string | number | null;
  approverEmployeeId?: string | number | null;
  paymentConfirmerEmployeeId?: string | number | null;
  clientCreatorEmployeeId?: string | number | null;
}

export interface FinanceRoleValidationResult {
  ok: boolean;
  fieldErrors: Record<string, string>;
  sanitizedDraft: Omit<FinanceRoleDraft, 'clientCreatorEmployeeId'>;
}

const EMPLOYEE_BENEFICIARY_CATEGORIES = new Set<FinanceExpenseCategory>([
  'salary',
  'reimbursement',
  'personal_advance',
]);

export function categoryRequiresEmployeeBeneficiary(category: FinanceExpenseCategory): boolean {
  return EMPLOYEE_BENEFICIARY_CATEGORIES.has(category);
}

export function visibleFinanceRoleFields(category: FinanceExpenseCategory): string[] {
  const common = ['beneficiary', 'payer', 'creator'];

  if (category === 'salary') {
    return [...common, 'approver', 'paymentConfirmer'];
  }

  if (category === 'reimbursement') {
    return [
      'beneficiary',
      'payer',
      'requester',
      'reimbursementRecipient',
      'approver',
      'paymentConfirmer',
      'creator',
    ];
  }

  if (category === 'supplier_payment') {
    return ['beneficiary', 'payer', 'approver', 'paymentConfirmer', 'creator'];
  }

  return common;
}

export function validateFinanceRoleDraft(draft: FinanceRoleDraft): FinanceRoleValidationResult {
  const { clientCreatorEmployeeId: _clientCreatorEmployeeId, ...sanitizedDraft } = draft;
  const fieldErrors: Record<string, string> = {};

  if (draft.category === 'salary') {
    if (!draft.beneficiaryEmployeeId) fieldErrors.beneficiaryEmployeeId = 'Vui lòng chọn Người hưởng lợi.';
    if (!draft.payerEmployeeId) fieldErrors.payerEmployeeId = 'Vui lòng chọn Người thực hiện chi.';
    if (draft.requesterEmployeeId) fieldErrors.requesterEmployeeId = 'Lương không dùng Người đề nghị hoàn trả.';
    if (draft.reimbursementRecipientEmployeeId) {
      fieldErrors.reimbursementRecipientEmployeeId = 'Lương không dùng Người nhận hoàn trả.';
    }
  }

  if (draft.category === 'reimbursement') {
    if (!draft.requesterEmployeeId) fieldErrors.requesterEmployeeId = 'Vui lòng chọn Người đề nghị hoàn trả.';
    if (!draft.reimbursementRecipientEmployeeId) {
      fieldErrors.reimbursementRecipientEmployeeId = 'Vui lòng chọn Người nhận hoàn trả.';
    }
    if (!draft.beneficiaryEmployeeId) fieldErrors.beneficiaryEmployeeId = 'Người hưởng lợi phải là Người nhận hoàn trả.';
  }

  if (draft.category === 'supplier_payment' && !draft.beneficiaryEmployeeId && !draft.beneficiaryExternalName?.trim()) {
    fieldErrors.beneficiaryExternalName = 'Vui lòng nhập Người hưởng lợi bên ngoài.';
  }

  if (categoryRequiresEmployeeBeneficiary(draft.category) && !draft.beneficiaryEmployeeId) {
    fieldErrors.beneficiaryEmployeeId ||= 'Vui lòng chọn Người hưởng lợi.';
  }

  return {
    ok: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    sanitizedDraft,
  };
}

export function buildBeneficiaryVietQrUrl(params: {
  beneficiary: EmployeePaymentProfile | null;
  amount: number | string;
  note: string;
}): { ok: true; url: string; accountHolderName: string } | { ok: false; message: string } {
  const bankName = params.beneficiary?.bankName?.trim();
  const bankAccountNumber = params.beneficiary?.bankAccountNumber?.trim();

  if (!params.beneficiary || !bankName || !bankAccountNumber) {
    return { ok: false, message: MISSING_EMPLOYEE_PAYMENT_INFO_MESSAGE };
  }

  const accountHolderName = params.beneficiary.accountHolderName?.trim() || params.beneficiary.fullName;
  const encodedNote = encodeURIComponent(params.note);

  return {
    ok: true,
    url: `https://img.vietqr.io/image/${bankName}-${bankAccountNumber}-compact2.png?amount=${params.amount}&addInfo=${encodedNote}`,
    accountHolderName,
  };
}

export const FINANCE_ATTACHMENT_POLICY = {
  maxSizeBytes: 10 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  allowedTypesLabel: 'JPG, PNG, WEBP hoặc PDF',
} as const;

export function validateFinanceAttachment(file: { name: string; size: number; type: string }): string | null {
  if (!FINANCE_ATTACHMENT_POLICY.allowedMimeTypes.includes(file.type as never)) {
    return 'Chứng từ chỉ hỗ trợ JPG, PNG, WEBP hoặc PDF.';
  }

  if (file.size > FINANCE_ATTACHMENT_POLICY.maxSizeBytes) {
    return 'Chứng từ không được vượt quá 10 MB.';
  }

  if (/[\\/\0]/.test(file.name)) {
    return 'Tên tệp chứng từ không hợp lệ.';
  }

  return null;
}

export function canTransitionReimbursement(params: {
  from: ReimbursementRequestStatus;
  to: ReimbursementRequestStatus;
  actorEmployeeId: string | number;
  requesterEmployeeId: string | number;
  hasFinancePermission: boolean;
  hasReviewPermission: boolean;
  rejectionReason?: string | null;
}): { ok: true } | { ok: false; message: string } {
  if (params.to === 'REJECTED' && !params.rejectionReason?.trim()) {
    return { ok: false, message: 'Từ chối yêu cầu cần có lý do.' };
  }

  if ((params.to === 'APPROVED' || params.to === 'REJECTED') && !params.hasReviewPermission) {
    return { ok: false, message: 'Bạn không có quyền duyệt hoàn trả.' };
  }

  if (params.to === 'PAID' && !params.hasFinancePermission) {
    return { ok: false, message: 'Bạn không có quyền xác nhận thanh toán.' };
  }

  if ((params.to === 'APPROVED' || params.to === 'PAID') && String(params.actorEmployeeId) === String(params.requesterEmployeeId)) {
    return { ok: false, message: 'Nhân sự không được tự duyệt hoặc tự xác nhận đã thanh toán.' };
  }

  const allowed: Record<ReimbursementRequestStatus, ReimbursementRequestStatus[]> = {
    DRAFT: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['UNDER_REVIEW', 'CANCELLED'],
    UNDER_REVIEW: ['APPROVED', 'REJECTED'],
    APPROVED: ['PAID'],
    REJECTED: ['DRAFT', 'CANCELLED'],
    PAID: [],
    CANCELLED: [],
  };

  if (!allowed[params.from].includes(params.to)) {
    return { ok: false, message: 'Trạng thái hoàn trả không hợp lệ.' };
  }

  return { ok: true };
}

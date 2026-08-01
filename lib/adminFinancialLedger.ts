import type { AdminLedgerMutationInput, FinancialLedgerEntry } from './types/finance';

export const UNKNOWN_BENEFICIARY_LABEL = 'Chưa xác định';

export class LedgerValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super('Dữ liệu giao dịch chưa hợp lệ.');
    this.name = 'LedgerValidationError';
  }
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function optionalId(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function validateAdminLedgerMutation(body: Record<string, unknown>): AdminLedgerMutationInput {
  const fieldErrors: Record<string, string> = {};
  const type = optionalText(body.type, 64) || '';
  const category = optionalText(body.category, 500) || '';
  const amount = Number(body.amount);
  const monthPeriod = optionalText(body.monthPeriod, 7) || '';
  const transactionDate = optionalText(body.transactionDate, 10);
  const beneficiaryEmployeeId = optionalId(body.beneficiaryEmployeeId);
  const beneficiaryExternalName = optionalText(body.beneficiaryExternalName, 200);
  const payerEmployeeId = optionalId(body.payerEmployeeId);
  const projectId = optionalId(body.projectId);
  const idempotencyKey = optionalText(body.idempotencyKey, 200);

  if (!type) fieldErrors.type = 'Vui lòng chọn loại giao dịch.';
  if (!category) fieldErrors.category = 'Vui lòng nhập khoản mục.';
  if (/^\[(Đối ứng|Hủy đối ứng)\]/i.test(category)) fieldErrors.category = 'Khoản mục đối ứng chỉ do hệ thống quản lý.';
  if (!Number.isFinite(amount) || amount <= 0) fieldErrors.amount = 'Số tiền phải lớn hơn 0.';
  if (!/^(0[1-9]|1[0-2])\/\d{4}$/.test(monthPeriod)) fieldErrors.monthPeriod = 'Kỳ báo cáo không hợp lệ.';
  if (transactionDate && (
    !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)
    || Number.isNaN(Date.parse(`${transactionDate}T00:00:00Z`))
    || new Date(`${transactionDate}T00:00:00Z`).toISOString().slice(0, 10) !== transactionDate
  )) {
    fieldErrors.transactionDate = 'Ngày giao dịch không hợp lệ.';
  }
  if (typeof body.isPaid !== 'boolean') fieldErrors.isPaid = 'Trạng thái thanh toán không hợp lệ.';
  if (idempotencyKey && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    fieldErrors.idempotencyKey = 'Mã chống ghi trùng không hợp lệ.';
  }
  if (body.beneficiaryEmployeeId != null && body.beneficiaryEmployeeId !== '' && !beneficiaryEmployeeId) {
    fieldErrors.beneficiaryEmployeeId = 'Người hưởng lợi không hợp lệ.';
  }
  if (beneficiaryEmployeeId && beneficiaryExternalName) {
    fieldErrors.beneficiaryExternalName = 'Chỉ chọn một Người hưởng lợi trong ERP hoặc bên ngoài.';
  }
  if (body.payerEmployeeId != null && body.payerEmployeeId !== '' && !payerEmployeeId) {
    fieldErrors.payerEmployeeId = 'Người thực hiện giao dịch không hợp lệ.';
  }
  if (body.projectId != null && body.projectId !== '' && !projectId) {
    fieldErrors.projectId = 'Dự án liên quan không hợp lệ.';
  }

  if (Object.keys(fieldErrors).length > 0) throw new LedgerValidationError(fieldErrors);

  return {
    type,
    subType: optionalText(body.subType, 64),
    category,
    amount,
    monthPeriod,
    transactionDate,
    description: optionalText(body.description, 2_000),
    projectId,
    beneficiaryEmployeeId,
    beneficiaryExternalName,
    payerEmployeeId,
    requestedBy: optionalText(body.requestedBy, 200),
    isPaid: body.isPaid === true,
    expenseSourceId: optionalText(body.expenseSourceId, 100),
    idempotencyKey,
  };
}

export function resolveLedgerPeople(
  entry: FinancialLedgerEntry,
  employeeNames: ReadonlyMap<string, string>
): FinancialLedgerEntry {
  const beneficiaryId = entry.beneficiary_employee_id == null ? null : String(entry.beneficiary_employee_id);
  const payerId = entry.payer_employee_id == null ? null : String(entry.payer_employee_id);

  return {
    ...entry,
    beneficiary_name:
      (beneficiaryId ? employeeNames.get(beneficiaryId) : null) ||
      entry.beneficiary_external_name?.trim() ||
      UNKNOWN_BENEFICIARY_LABEL,
    payer_name: (payerId ? employeeNames.get(payerId) : null) || entry.requested_by?.trim() || null,
  };
}

export function financeAttachmentExtension(file: { name: string; type: string }): string {
  const byMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  };
  return byMime[file.type] || file.name.split('.').pop()?.toLowerCase() || 'bin';
}

export async function hasValidFinanceAttachmentSignature(file: {
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}): Promise<boolean> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === 'image/png') return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  if (file.type === 'image/webp') {
    return bytes.length >= 12
      && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === 'RIFF'
      && String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === 'WEBP';
  }
  if (file.type === 'application/pdf') return bytes.length >= 5 && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]) === '%PDF-';
  return false;
}

export function ledgerUpdateRequiresAtomicLink(input: {
  hasExistingLink: boolean;
  type: string;
  expenseSourceId?: string | null;
}): boolean {
  return input.hasExistingLink || (input.type === 'CHI_PHI' && Boolean(input.expenseSourceId?.startsWith('SHAREHOLDER:')));
}

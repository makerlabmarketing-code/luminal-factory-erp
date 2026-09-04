import type { AdminLedgerMutationInput, FinancialLedgerEntry } from '@/lib/types/finance';

interface LedgerResponse {
  ledger: FinancialLedgerEntry[];
  extendedSchemaEnabled: boolean;
  attachmentsEnabled: boolean;
  projects: Array<{ id: number | string; name: string }>;
  reimbursementCapabilities: {
    currentEmployeeId: string;
    canApprove: boolean;
    canPay: boolean;
  };
  message?: string;
}

export async function transitionAdminReimbursement(
  ledgerId: number | string,
  status: 'APPROVED' | 'REJECTED' | 'PAID',
  reason: string | null = null,
) {
  await payload(await fetch('/api/admin/finance/reimbursements', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ledgerId, status, reason, idempotencyKey: crypto.randomUUID() }),
  }));
}

async function payload(response: Response) {
  const body = await response.json() as { message?: string; [key: string]: unknown };
  if (!response.ok) throw new Error(body.message || 'Không thể xử lý sổ thu chi.');
  return body;
}

export async function loadAdminFinancialLedger(monthPeriod: string): Promise<LedgerResponse> {
  const response = await fetch(`/api/admin/finance/ledger?month=${encodeURIComponent(monthPeriod)}`, { credentials: 'include', cache: 'no-store' });
  return await payload(response) as unknown as LedgerResponse;
}

export async function createAdminFinancialLedger(input: AdminLedgerMutationInput): Promise<number | string> {
  const response = await fetch('/api/admin/finance/ledger', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  const body = await payload(response) as { ledgerId?: number | string };
  if (body.ledgerId == null) throw new Error('Không nhận được mã giao dịch vừa tạo.');
  return body.ledgerId;
}

export async function updateAdminFinancialLedger(ledgerId: number | string, input: AdminLedgerMutationInput) {
  const response = await fetch(`/api/admin/finance/ledger/${ledgerId}`, {
    method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  await payload(response);
}

export async function setAdminFinancialLedgerPaid(ledgerId: number | string, isPaid: boolean) {
  const response = await fetch(`/api/admin/finance/ledger/${ledgerId}`, {
    method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPaid }),
  });
  await payload(response);
}

export async function uploadAdminLedgerAttachment(ledgerId: number | string, file: File) {
  const form = new FormData();
  form.set('file', file);
  await payload(await fetch(`/api/admin/finance/ledger/${ledgerId}/attachments`, { method: 'POST', credentials: 'include', body: form }));
}

export async function replaceAdminLedgerAttachment(ledgerId: number | string, attachmentId: number | string, file: File) {
  const form = new FormData();
  form.set('file', file);
  return await payload(await fetch(`/api/admin/finance/ledger/${ledgerId}/attachments/${attachmentId}`, { method: 'PUT', credentials: 'include', body: form })) as { success: boolean; cleanupPending: boolean };
}

export async function removeAdminLedgerAttachment(ledgerId: number | string, attachmentId: number | string) {
  return await payload(await fetch(`/api/admin/finance/ledger/${ledgerId}/attachments/${attachmentId}`, { method: 'DELETE', credentials: 'include' })) as { success: boolean; cleanupPending: boolean };
}

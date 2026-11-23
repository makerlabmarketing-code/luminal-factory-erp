import { raffleDateToVietnamInput, raffleVietnamInputToDate } from './raffle-draft';
import { isRaffleUuid, type CommerceRaffle } from './raffle-input';

export const raffleAllocationLabels = {
  SELECTED: 'Chờ báo giá', CONFIRMED: 'Đã xác nhận', PAYMENT_PENDING: 'Chờ thanh toán',
  PAID: 'Đã nhận tiền', FULFILLING: 'Đang chuẩn bị gửi', COMPLETED: 'Đã gửi hàng',
  CANCELLED: 'Đã hủy', REALLOCATED: 'Đã thay người trúng',
} as const;

export const raffleActions = {
  select: { outcome: 'SELECTED', label: 'Ghi nhận người trúng', capability: 'COMMERCE_RAFFLE_MANAGE', scope: 'commerce.raffle.winner.manage' },
  cancel: { outcome: 'CANCELLED', label: 'Hủy suất trúng', capability: 'COMMERCE_RAFFLE_MANAGE', scope: 'commerce.raffle.winner.manage' },
  reallocate: { outcome: 'SELECTED', label: 'Chọn người thay thế', capability: 'COMMERCE_RAFFLE_MANAGE', scope: 'commerce.raffle.winner.manage' },
  'confirm-payment': { outcome: 'PAID', label: 'Xác nhận đã nhận tiền', capability: 'COMMERCE_RAFFLE_PAYMENT_CONFIRM', scope: 'commerce.raffle.payment.manage' },
  fulfillment: { outcome: 'FULFILLING', label: 'Bắt đầu chuẩn bị hàng', capability: 'COMMERCE_RAFFLE_FULFILLMENT_MANAGE', scope: 'commerce.raffle.fulfillment.manage' },
  complete: { outcome: 'COMPLETED', label: 'Xác nhận đã gửi hàng', capability: 'COMMERCE_RAFFLE_FULFILLMENT_MANAGE', scope: 'commerce.raffle.fulfillment.manage' },
} as const;

export type RaffleAction = keyof typeof raffleActions;
export type RaffleAllocation = {
  id: string;
  raffle_id: string;
  raffle_entry_id: string;
  public_code: string;
  status: keyof typeof raffleAllocationLabels;
  paid_at: string | null;
  payment_deadline_at: string | null;
  fulfillment_due_at: string | null;
};

export function isRaffleAllocation(value: unknown): value is RaffleAllocation {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<RaffleAllocation>;
  const validId = (id: unknown) => typeof id === 'string' && isRaffleUuid(id);
  return validId(row.id) && validId(row.raffle_id) && validId(row.raffle_entry_id)
    && typeof row.public_code === 'string' && /^[A-Z0-9]{1,32}$/.test(row.public_code)
    && typeof row.status === 'string' && Object.hasOwn(raffleAllocationLabels, row.status)
    && [row.paid_at, row.payment_deadline_at, row.fulfillment_due_at].every(
      date => date === null || typeof date === 'string' && Number.isFinite(Date.parse(date)),
    );
}

export function allocationSummary(allocation: RaffleAllocation): RaffleAllocation {
  const { id, raffle_id, raffle_entry_id, public_code, status, paid_at, payment_deadline_at, fulfillment_due_at } = allocation;
  return { id, raffle_id, raffle_entry_id, public_code, status, paid_at, payment_deadline_at, fulfillment_due_at };
}

export function canRecordRaffleWinner(raffle: CommerceRaffle, now: number) {
  return raffle.product_id !== null && ['CLOSED', 'DRAWING', 'DRAWN', 'PAYMENT_PENDING', 'FULFILLING'].includes(raffle.status)
    && raffle.closes_at !== null && Date.parse(raffle.closes_at) <= now;
}

export function raffleFulfillmentDueInput(paidAt: string | null) {
  const input = raffleDateToVietnamInput(paidAt);
  if (!input) return '';
  const date = new Date(input + 'Z');
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const end = new Date(date);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  date.setUTCDate(Math.min(day, end.getUTCDate()));
  return date.toISOString().slice(0, 19);
}

export function parseRaffleOperationsInput(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const fields = input as Record<string, unknown>;
  if (typeof fields.action !== 'string' || !Object.hasOwn(raffleActions, fields.action)
    || typeof fields.operationId !== 'string' || !isRaffleUuid(fields.operationId)) return null;
  const action = fields.action as RaffleAction;
  const { operationId } = fields;
  const keys = (...allowed: string[]) => Object.keys(fields).every(key => ['action', 'operationId', ...allowed].includes(key));
  if (action === 'select') {
    return keys('entryId') && typeof fields.entryId === 'string' && isRaffleUuid(fields.entryId)
      ? { action, allocationId: null, body: { operationId, entryId: fields.entryId } } : null;
  }
  const { allocationId } = fields;
  if (typeof allocationId !== 'string' || !isRaffleUuid(allocationId)) return null;
  switch (action) {
    case 'reallocate':
      return keys('allocationId', 'replacementEntryId') && typeof fields.replacementEntryId === 'string' && isRaffleUuid(fields.replacementEntryId)
        ? { action, allocationId, body: { operationId, replacementEntryId: fields.replacementEntryId } } : null;
    case 'cancel': {
      const reason = typeof fields.reason === 'string' ? fields.reason.trim() : '';
      return keys('allocationId', 'reason') && reason.length >= 3 && reason.length <= 500
        ? { action, allocationId, body: { operationId, reason } } : null;
    }
    case 'confirm-payment': {
      const paymentReference = typeof fields.paymentReference === 'string' ? fields.paymentReference.trim() : '';
      return keys('allocationId', 'paymentReference', 'verified') && fields.verified === true
        && paymentReference.length > 0 && paymentReference.length <= 160
        ? { action, allocationId, body: { operationId, paymentReference } } : null;
    }
    case 'fulfillment': {
      const fulfillmentDueAt = typeof fields.fulfillmentDue === 'string' ? raffleVietnamInputToDate(fields.fulfillmentDue) : null;
      return keys('allocationId', 'fulfillmentDue') && fulfillmentDueAt
        ? { action, allocationId, body: { operationId, fulfillmentDueAt } } : null;
    }
    case 'complete': {
      const note = typeof fields.note === 'string' ? fields.note.trim() : '';
      return keys('allocationId', 'note') && note.length > 0 && note.length <= 500
        ? { action, allocationId, body: { operationId, note } } : null;
    }
  }
}

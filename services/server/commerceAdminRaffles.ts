import 'server-only';
import { requestCommerceAdmin } from './commerceAdminIntegration';
import { CommerceAdminIntegrationError } from './commerceAdminIntegration';
import { isCommerceRaffle, isCommerceRaffleEntry, isRaffleUuid, type CommerceRaffle, type CommerceRaffleEntry } from '@/lib/commerce-admin/raffle-input';

export function listCommerceRaffles() {
  return requestCommerceAdmin({capability:'COMMERCE_RAFFLE_VIEW',scope:'commerce.raffle.read',method:'GET',path:'/api/admin/v1/raffles'},
    (value): value is CommerceRaffle[] => Array.isArray(value) && value.length <= 200 && value.every(isCommerceRaffle));
}
export function listCommerceRaffleEntries(id: string) {
  if (!isRaffleUuid(id)) throw new CommerceAdminIntegrationError('REQUEST_INVALID','Mã raffle không hợp lệ.',400);
  return requestCommerceAdmin({capability:'COMMERCE_RAFFLE_ENTRY_VIEW',scope:'commerce.raffle.entry.read',method:'GET',path:`/api/admin/v1/raffles/${id}/entries`},
    (value): value is CommerceRaffleEntry[] => Array.isArray(value) && value.length <= 5000 && value.every(entry => isCommerceRaffleEntry(entry) && entry.raffle_id === id));
}

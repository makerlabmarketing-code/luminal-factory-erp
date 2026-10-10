import 'server-only';
import { requestCommerceAdmin } from './commerceAdminIntegration';
import { CommerceAdminIntegrationError } from './commerceAdminIntegration';
import { isCommerceRaffle, isCommerceRaffleEntry, isRaffleUuid, type CommerceRaffle, type CommerceRaffleEntry } from '@/lib/commerce-admin/raffle-input';
import { canEditRaffleInformation, type RaffleInformationMutation } from '@/lib/commerce-admin/raffle-draft';
import { requireCommerceRaffleAccess } from './commerceAdminRaffleAccess';

export function listCommerceRaffles() {
  return requestCommerceAdmin({capability:'COMMERCE_RAFFLE_VIEW',scope:'commerce.raffle.read',method:'GET',path:'/api/admin/v1/raffles'},
    (value): value is CommerceRaffle[] => Array.isArray(value) && value.length <= 200 && value.every(isCommerceRaffle));
}
export async function getCommerceRaffle(id: string) {
  if (!isRaffleUuid(id)) throw new CommerceAdminIntegrationError('REQUEST_INVALID','Mã raffle không hợp lệ.',400);
  const raffle = (await listCommerceRaffles()).find(row => row.id === id);
  if (!raffle) throw new CommerceAdminIntegrationError('REMOTE_REJECTED','Không tìm thấy raffle.',404);
  return raffle;
}
export async function getCommerceRaffleInformation(id: string) {
  const raffle = await getCommerceRaffle(id);
  return { raffle, viewedAt: Date.now() };
}
export async function updateCommerceRaffleInformation(id: string, mutation: RaffleInformationMutation) {
  await requireCommerceRaffleAccess('COMMERCE_RAFFLE_MANAGE');
  const current = await getCommerceRaffle(id);
  if (!canEditRaffleInformation(current)) throw new CommerceAdminIntegrationError('REMOTE_REJECTED','Chỉ sửa thông tin của bản nháp chưa công khai.',409);
  const body = {operationId: mutation.operationId, draft: {
    slug:current.slug, title:mutation.information.title, summary:mutation.information.summary,
    rulesSummary:mutation.information.rulesSummary, rulesVersion:current.rules_version,
    productId:current.product_id, variantId:current.variant_id, opensAt:mutation.information.opensAt,
    closesAt:mutation.information.closesAt, status:'DRAFT', isTest:false,
  }};
  return requestCommerceAdmin({capability:'COMMERCE_RAFFLE_MANAGE',scope:'commerce.raffle.write',method:'PATCH',path:`/api/admin/v1/raffles/${id}`,body},
    (value): value is CommerceRaffle => isCommerceRaffle(value) && value.id === id);
}
export function listCommerceRaffleEntries(id: string) {
  if (!isRaffleUuid(id)) throw new CommerceAdminIntegrationError('REQUEST_INVALID','Mã raffle không hợp lệ.',400);
  return requestCommerceAdmin({capability:'COMMERCE_RAFFLE_ENTRY_VIEW',scope:'commerce.raffle.entry.read',method:'GET',path:`/api/admin/v1/raffles/${id}/entries`},
    (value): value is CommerceRaffleEntry[] => Array.isArray(value) && value.length <= 5000 && value.every(entry => isCommerceRaffleEntry(entry) && entry.raffle_id === id));
}

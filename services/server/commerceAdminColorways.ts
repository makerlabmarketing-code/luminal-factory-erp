import 'server-only';
import { commerceColorwayEndpoints, type CommerceColorwayMutation, type CommerceColorwayRecord } from '@/lib/commerce-admin/contracts';
import { isColorwayRecord } from '@/lib/commerce-admin/colorway-input';
import { requestCommerceAdmin } from './commerceAdminIntegration';
export function listCommerceColorways(productId: string) {
  return requestCommerceAdmin(commerceColorwayEndpoints.list(productId), (value): value is CommerceColorwayRecord[] =>
    Array.isArray(value) && value.length <= 200 && value.every(row => isColorwayRecord(row) && row.product_id === productId));
}
export function saveCommerceColorway(productId: string, variantId: string | null, mutation: CommerceColorwayMutation) {
  return requestCommerceAdmin(commerceColorwayEndpoints.save(productId, variantId, mutation), (value): value is CommerceColorwayRecord =>
    isColorwayRecord(value) && value.product_id === productId && !value.is_active && (!variantId || value.id === variantId));
}

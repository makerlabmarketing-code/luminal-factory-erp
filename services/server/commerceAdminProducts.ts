import 'server-only';

import {
  commerceProductEndpoints,
  type CommerceProductRecord,
  type CommerceProductDraftMutation,
} from '@/lib/commerce-admin/contracts';
import { requestCommerceAdmin } from '@/services/server/commerceAdminIntegration';

import { isProductRecord } from '@/lib/commerce-admin/product-input';

export async function listCommerceProducts(): Promise<CommerceProductRecord[]> {
  return requestCommerceAdmin(
    commerceProductEndpoints.list(),
    (value): value is CommerceProductRecord[] =>
      Array.isArray(value) && value.length <= 200 && value.every(isProductRecord),
  );
}

export function createCommerceProductDraft(mutation: CommerceProductDraftMutation) {
  return requestCommerceAdmin(commerceProductEndpoints.create(mutation), isProductRecord);
}

export function updateCommerceProductDraft(id: string, mutation: CommerceProductDraftMutation) {
  return requestCommerceAdmin(commerceProductEndpoints.update(id, mutation), isProductRecord);
}

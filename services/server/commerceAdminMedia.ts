import 'server-only';
import { requestCommerceAdmin } from './commerceAdminIntegration';
import { mediaEditorPath, isMediaManifest, isMediaPresentation, isMediaTicket, type MediaManifest, type MediaPresentation, type MediaTicket, type MediaTarget, type MediaTicketInput, type MediaMutation } from '@/lib/commerce-admin/media-input';
export async function requestMedia(target: MediaTarget, method: 'GET' | 'POST' | 'PATCH', body?: MediaTicketInput | MediaMutation, ticket = false) {
  const path = mediaEditorPath(target).replace('/api/admin/commerce/','/api/admin/v1/') + (ticket ? '/upload-ticket' : '');
  return requestCommerceAdmin({ path, method, capability:method === 'GET' ? 'COMMERCE_PRODUCT_VIEW' : 'COMMERCE_PRODUCT_MANAGE',scope:method === 'GET' ? 'commerce.product.read' : 'commerce.product.write', ...(body ? { body } : {}) },
    (v): v is MediaManifest | MediaPresentation | MediaTicket => ticket ? isMediaTicket(v,target,body as MediaTicketInput) : method === 'GET' ? isMediaPresentation(v,target) : isMediaManifest(v,target));
}

import 'server-only';
import { UUID_PATTERN } from '@/lib/commerce-admin/product-input';
import { parseMediaMutation, parseMediaTicketInput } from '@/lib/commerce-admin/media-input';
import { requireCommerceProductAccess } from './commerceAdminProductAccess';
import { requestMedia } from './commerceAdminMedia';
import { commerceAdminJson, commerceAdminRouteError } from './commerceAdminRouteResponse';
export async function handleErpMedia(request: Request, params: Promise<{ id: string; variantId?: string }>, ticket = false) {
  try {
    const read = request.method === 'GET';
    await requireCommerceProductAccess(read ? 'COMMERCE_PRODUCT_VIEW' : 'COMMERCE_PRODUCT_MANAGE');
    const { id,variantId } = await params;
    if (!UUID_PATTERN.test(id) || variantId !== undefined && !UUID_PATTERN.test(variantId)) return commerceAdminJson({ success:false,message:'Sản phẩm/phối màu không hợp lệ.' },{ status:400 });
    const value: unknown = read ? null : await request.json().catch(() => null);
    const input = read ? undefined : ticket ? parseMediaTicketInput(value) : parseMediaMutation(value,request.method === 'POST');
    if (!read && !input) return commerceAdminJson({ success:false,message:'Thông tin ảnh không hợp lệ.' },{ status:400 });
    const media = await requestMedia({ productId:id,variantId:variantId ?? null },read ? 'GET' : request.method === 'PATCH' ? 'PATCH' : 'POST',input ?? undefined,ticket);
    return commerceAdminJson({ success:true,media });
  } catch (error) { return commerceAdminRouteError(error,'Không thể truy cập bộ ảnh.'); }
}

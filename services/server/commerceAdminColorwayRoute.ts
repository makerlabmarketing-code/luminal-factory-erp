import 'server-only';
import { UUID_PATTERN } from '@/lib/commerce-admin/product-input';
import { parseColorwayMutation } from '@/lib/commerce-admin/colorway-input';
import { requireCommerceProductAccess } from './commerceAdminProductAccess';
import { listCommerceColorways, saveCommerceColorway } from './commerceAdminColorways';
import { commerceAdminJson, commerceAdminRouteError } from './commerceAdminRouteResponse';
export async function handleERPColorway(request: Request, params: Promise<{ id: string; variantId?: string }>) {
  try {
    const read = request.method === 'GET';
    await requireCommerceProductAccess(read ? 'COMMERCE_PRODUCT_VIEW' : 'COMMERCE_PRODUCT_MANAGE');
    const { id, variantId } = await params;
    if (!UUID_PATTERN.test(id) || (variantId !== undefined && !UUID_PATTERN.test(variantId))) return commerceAdminJson({ success: false, message: 'Mã sản phẩm/phối màu không hợp lệ.' }, { status: 400 });
    if (read) return commerceAdminJson({ success: true, colorways: await listCommerceColorways(id) });
    const mutation = parseColorwayMutation(await request.json().catch(() => null));
    if (!mutation) return commerceAdminJson({ success: false, message: 'Thông tin phối màu không hợp lệ.' }, { status: 400 });
    const colorway = await saveCommerceColorway(id, variantId ?? null, mutation);
    return commerceAdminJson({ success: true, colorway }, { status: variantId ? 200 : 201 });
  } catch (error) { return commerceAdminRouteError(error, 'Không thể truy cập phối màu.'); }
}

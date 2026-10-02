import { parseCommerceProductDraftMutation, UUID_PATTERN } from '@/lib/commerce-admin/product-input';
import { requireCommerceProductAccess } from '@/services/server/commerceAdminProductAccess';
import { updateCommerceProductDraft } from '@/services/server/commerceAdminProducts';
import { commerceAdminJson, commerceAdminRouteError } from '@/services/server/commerceAdminRouteResponse';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireCommerceProductAccess('COMMERCE_PRODUCT_MANAGE');
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) return commerceAdminJson({ success: false, message: 'Mã sản phẩm không hợp lệ.' }, { status: 400 });
    const mutation = parseCommerceProductDraftMutation(await request.json().catch(() => null));
    if (!mutation) return commerceAdminJson({ success: false, message: 'Thông tin sản phẩm không hợp lệ. Keycap chỉ được phát hành qua raffle.' }, { status: 400 });
    const product = await updateCommerceProductDraft(id, mutation);
    return commerceAdminJson({ success: true, product });
  } catch (error) {
    return commerceAdminRouteError(error, 'Không thể lưu bản nháp sản phẩm.');
  }
}

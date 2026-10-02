import { parseCommerceProductDraftMutation } from '@/lib/commerce-admin/product-input';
import { requireCommerceProductAccess } from '@/services/server/commerceAdminProductAccess';
import { createCommerceProductDraft, listCommerceProducts } from '@/services/server/commerceAdminProducts';
import { commerceAdminJson, commerceAdminRouteError } from '@/services/server/commerceAdminRouteResponse';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await listCommerceProducts();
    return commerceAdminJson({ success: true, products });
  } catch (error) {
    return commerceAdminRouteError(error, 'Không thể tải danh mục sản phẩm.');
  }
}

export async function POST(request: Request) {
  try {
    await requireCommerceProductAccess('COMMERCE_PRODUCT_MANAGE');
    const mutation = parseCommerceProductDraftMutation(await request.json().catch(() => null));
    if (!mutation) return commerceAdminJson({ success: false, message: 'Thông tin sản phẩm không hợp lệ. Keycap chỉ được phát hành qua raffle.' }, { status: 400 });
    const product = await createCommerceProductDraft(mutation);
    return commerceAdminJson({ success: true, product }, { status: 201 });
  } catch (error) {
    return commerceAdminRouteError(error, 'Không thể tạo bản nháp sản phẩm.');
  }
}

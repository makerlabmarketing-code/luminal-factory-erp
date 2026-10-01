import { listCommerceProducts } from '@/services/server/commerceAdminProducts';
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

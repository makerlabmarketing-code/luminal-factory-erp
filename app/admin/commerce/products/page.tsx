import { listCommerceProducts } from '@/services/server/commerceAdminProducts';
import { requireCommerceProductAccess } from '@/services/server/commerceAdminProductAccess';
import { hasPermission, AuthFlowError } from '@/services/server/auth';
import { isCommerceAdminIntegrationEnabled } from '@/services/server/commerceAdminIntegration';
import ProductManagerClient from './ProductManagerClient';

export const dynamic = 'force-dynamic';

export default async function CommerceProductsPage() {
  try {
    const context = await requireCommerceProductAccess('COMMERCE_PRODUCT_VIEW');
    const canManage = await hasPermission(context, 'COMMERCE_PRODUCT_MANAGE');
    const integrationEnabled = isCommerceAdminIntegrationEnabled();
    let products: Awaited<ReturnType<typeof listCommerceProducts>> = [];
    let loadError: string | null = null;
    if (integrationEnabled) {
      try { products = await listCommerceProducts(); }
      catch { loadError = 'Không thể tải danh mục sản phẩm. Vui lòng tải lại danh sách.'; }
    }
    return <ProductManagerClient initialProducts={products} canManage={canManage} integrationEnabled={integrationEnabled} loadError={loadError} />;
  } catch (error) {
    return <div className="admin-page"><h1 className="admin-page-title">Danh mục sản phẩm</h1><p role="alert" className="admin-card mt-4 p-5 text-sm">{error instanceof AuthFlowError ? error.message : 'Không thể xác minh quyền truy cập sản phẩm.'}</p></div>;
  }
}

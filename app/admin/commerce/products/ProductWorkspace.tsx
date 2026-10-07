import Link from 'next/link';
import { listCommerceProducts } from '@/services/server/commerceAdminProducts';
import { requireCommerceProductAccess } from '@/services/server/commerceAdminProductAccess';
import { hasPermission, AuthFlowError } from '@/services/server/auth';
import { isCommerceAdminIntegrationEnabled } from '@/services/server/commerceAdminIntegration';
import ProductManagerClient from './ProductManagerClient';

export default async function ProductWorkspace({ productId, create = false }: { productId?: string; create?: boolean }) {
  try {
    const context = await requireCommerceProductAccess(create ? 'COMMERCE_PRODUCT_MANAGE' : 'COMMERCE_PRODUCT_VIEW');
    const canManage = await hasPermission(context, 'COMMERCE_PRODUCT_MANAGE');
    const integrationEnabled = isCommerceAdminIntegrationEnabled();
    const editor = create || productId !== undefined;
    let products: Awaited<ReturnType<typeof listCommerceProducts>> = [];
    let loadError: string | null = null;
    if (integrationEnabled && !create) {
      try { products = await listCommerceProducts(); }
      catch { loadError = 'Không thể tải danh mục sản phẩm. Vui lòng thử lại.'; }
    }
    const selectedProduct = products.find(product => product.id === productId) ?? null;
    if (productId && !selectedProduct) return <div className="admin-page space-y-4"><h1 className="admin-page-title">Chi tiết sản phẩm</h1><p role="alert" className="admin-card p-5">{loadError ?? (!integrationEnabled ? 'Kết nối Commerce đang tắt.' : 'Không tìm thấy sản phẩm trong danh mục đã tải.')}</p><Link href="/admin/commerce/products">Quay lại danh sách</Link></div>;
    return <ProductManagerClient key={productId ?? (create ? 'new' : 'list')} initialProducts={editor ? selectedProduct ? [selectedProduct] : [] : products} selectedProduct={selectedProduct} editor={editor} canManage={canManage} integrationEnabled={integrationEnabled} loadError={loadError} mediaEnabled={process.env.COMMERCE_CATALOG_MEDIA_ENABLED === 'true'} informationUpdateEnabled={process.env.COMMERCE_PRODUCT_INFORMATION_UPDATE_ENABLED === 'true'} />;
  } catch (error) {
    return <div className="admin-page"><h1 className="admin-page-title">Danh mục sản phẩm</h1><p role="alert" className="admin-card mt-4 p-5 text-sm">{error instanceof AuthFlowError ? error.message : 'Không thể xác minh quyền truy cập sản phẩm.'}</p></div>;
  }
}

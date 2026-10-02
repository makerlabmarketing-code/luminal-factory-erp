import 'server-only';
import { AuthFlowError, hasPermission, requireWorkspaceAccess } from '@/services/server/auth';

export async function requireCommerceProductAccess(capability: 'COMMERCE_PRODUCT_VIEW' | 'COMMERCE_PRODUCT_MANAGE') {
  const context = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  if (!(await hasPermission(context, capability))) {
    throw new AuthFlowError({ status: 403, code: 'permission_forbidden',
      message: 'Bạn không có quyền thực hiện thao tác sản phẩm.', failureStage: 'permission_check' });
  }
  return context;
}

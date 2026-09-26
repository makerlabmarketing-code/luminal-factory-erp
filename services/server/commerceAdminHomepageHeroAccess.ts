import 'server-only';

import type { CommerceAdminCapability } from '@/lib/commerce-admin/contracts';
import {
  AuthFlowError,
  hasPermission,
  requireWorkspaceAccess,
} from '@/services/server/auth';

export async function requireHomepageHeroAccess(
  capability: CommerceAdminCapability,
) {
  const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  if (!(await hasPermission(authContext, capability))) {
    throw new AuthFlowError({
      status: 403,
      code: 'permission_forbidden',
      message:
        capability === 'COMMERCE_HOMEPAGE_HERO_VIEW'
          ? 'Bạn không có quyền xem cấu hình Hero trang chủ.'
          : 'Bạn không có quyền quản lý Hero trang chủ.',
      failureStage: 'permission_check',
    });
  }
  return authContext;
}

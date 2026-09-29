import { AuthFlowError } from '@/services/server/auth';
import { requireHomepageHeroAccess } from '@/services/server/commerceAdminHomepageHeroAccess';
import HomepageHeroManagerClient from './HomepageHeroManagerClient';

export default async function HomepageHeroAdminPage() {
  try {
    await requireHomepageHeroAccess('COMMERCE_HOMEPAGE_HERO_VIEW');
  } catch (error) {
    const message =
      error instanceof AuthFlowError
        ? error.message
        : 'Không thể xác minh quyền quản lý Hero trang chủ.';

    return (
      <div className="admin-page">
        <div className="admin-card p-6">
          <h1 className="admin-page-title">Hero trang chủ</h1>
          <p className="mt-2 text-sm text-slate-400">{message}</p>
        </div>
      </div>
    );
  }

  return <HomepageHeroManagerClient />;
}

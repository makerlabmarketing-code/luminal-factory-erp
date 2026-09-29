import { listHomepageHeroAssets } from '@/services/server/commerceAdminHomepageHero';
import { requireHomepageHeroAccess } from '@/services/server/commerceAdminHomepageHeroAccess';
import {
  commerceAdminJson,
  commerceAdminRouteError,
} from '@/services/server/commerceAdminRouteResponse';

export async function GET() {
  try {
    await requireHomepageHeroAccess('COMMERCE_HOMEPAGE_HERO_VIEW');
    const assets = await listHomepageHeroAssets();
    return commerceAdminJson({ success: true, assets });
  } catch (error) {
    return commerceAdminRouteError(error, 'Không thể tải thư viện Hero.');
  }
}

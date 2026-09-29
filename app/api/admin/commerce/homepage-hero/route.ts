import {
  createHomepageHeroDraft,
  listHomepageHeroPresentations,
} from '@/services/server/commerceAdminHomepageHero';
import { requireHomepageHeroAccess } from '@/services/server/commerceAdminHomepageHeroAccess';
import {
  commerceAdminJson,
  commerceAdminRouteError,
} from '@/services/server/commerceAdminRouteResponse';
import { parseHomepageHeroDraftMutation } from '@/lib/commerce-admin/homepage-hero-input';

export async function GET() {
  try {
    await requireHomepageHeroAccess('COMMERCE_HOMEPAGE_HERO_VIEW');
    const heroes = await listHomepageHeroPresentations();
    return commerceAdminJson({ success: true, heroes });
  } catch (error) {
    return commerceAdminRouteError(error, 'Không thể tải danh sách Hero trang chủ.');
  }
}

export async function POST(request: Request) {
  try {
    await requireHomepageHeroAccess('COMMERCE_HOMEPAGE_HERO_MANAGE');
    const mutation = parseHomepageHeroDraftMutation(
      await request.json().catch(() => null),
    );
    if (!mutation) {
      return commerceAdminJson(
        {
          success: false,
          code: 'payload_validation_failed',
          message: 'Cấu hình Hero không hợp lệ.',
        },
        { status: 400 },
      );
    }
    const hero = await createHomepageHeroDraft(mutation);
    return commerceAdminJson({ success: true, hero }, { status: 201 });
  } catch (error) {
    return commerceAdminRouteError(error, 'Không thể tạo bản nháp Hero.');
  }
}

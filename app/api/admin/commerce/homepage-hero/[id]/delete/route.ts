import { deleteHomepageHeroDraft } from '@/services/server/commerceAdminHomepageHero';
import { requireHomepageHeroAccess } from '@/services/server/commerceAdminHomepageHeroAccess';
import { commerceAdminJson, commerceAdminRouteError } from '@/services/server/commerceAdminRouteResponse';
import { parseHomepageHeroId, parseHomepageHeroPublishMutation } from '@/lib/commerce-admin/homepage-hero-input';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireHomepageHeroAccess('COMMERCE_HOMEPAGE_HERO_MANAGE');
    const heroId = parseHomepageHeroId(params.id);
    const mutation = parseHomepageHeroPublishMutation(await request.json().catch(() => null));
    if (!heroId || !mutation) {
      return commerceAdminJson({ success: false, code: 'payload_validation_failed', message: 'Yêu cầu xóa bản nháp không hợp lệ.' }, { status: 400 });
    }
    const result = await deleteHomepageHeroDraft(heroId, mutation);
    return commerceAdminJson({ success: true, ...result });
  } catch (error) {
    return commerceAdminRouteError(error, 'Không thể xóa bản nháp Hero.');
  }
}

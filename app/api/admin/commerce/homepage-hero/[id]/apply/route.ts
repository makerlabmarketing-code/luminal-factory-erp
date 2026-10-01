import { applyHomepageHeroLive } from '@/services/server/commerceAdminHomepageHero';
import { requireHomepageHeroAccess } from '@/services/server/commerceAdminHomepageHeroAccess';
import { commerceAdminJson, commerceAdminRouteError } from '@/services/server/commerceAdminRouteResponse';
import { parseHomepageHeroDraftMutation, parseHomepageHeroId } from '@/lib/commerce-admin/homepage-hero-input';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireHomepageHeroAccess('COMMERCE_HOMEPAGE_HERO_MANAGE');
    const heroId = parseHomepageHeroId(params.id);
    const raw: unknown = await request.json().catch(() => null);
    const payload = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw as Record<string, unknown>
      : null;
    const mutation = parseHomepageHeroDraftMutation(payload);
    const expectedUpdatedAt = typeof payload?.expectedUpdatedAt === 'string'
      && !Number.isNaN(Date.parse(payload.expectedUpdatedAt))
      ? payload.expectedUpdatedAt
      : null;
    if (!heroId || !mutation || !expectedUpdatedAt) {
      return commerceAdminJson({
        success: false, code: 'payload_validation_failed', message: 'Cấu hình áp dụng Hero không hợp lệ.',
      }, { status: 400 });
    }
    const hero = await applyHomepageHeroLive(heroId, { ...mutation, expectedUpdatedAt });
    return commerceAdminJson({ success: true, hero });
  } catch (error) {
    return commerceAdminRouteError(error, 'Không thể áp dụng Hero lên trang chủ.');
  }
}

import { createHomepageHeroAssetUploadTicket } from '@/services/server/commerceAdminHomepageHero';
import { requireHomepageHeroAccess } from '@/services/server/commerceAdminHomepageHeroAccess';
import {
  commerceAdminJson,
  commerceAdminRouteError,
} from '@/services/server/commerceAdminRouteResponse';
import { parseHomepageHeroAssetUploadTicketRequest } from '@/lib/commerce-admin/homepage-hero-input';

export async function POST(request: Request) {
  try {
    await requireHomepageHeroAccess('COMMERCE_HOMEPAGE_HERO_MANAGE');
    const input = parseHomepageHeroAssetUploadTicketRequest(
      await request.json().catch(() => null),
    );
    if (!input) {
      return commerceAdminJson(
        {
          success: false,
          code: 'payload_validation_failed',
          message: 'Tệp Hero không hợp lệ.',
        },
        { status: 400 },
      );
    }
    const ticket = await createHomepageHeroAssetUploadTicket(input);
    return commerceAdminJson({ success: true, ticket }, { status: 201 });
  } catch (error) {
    return commerceAdminRouteError(error, 'Không thể chuẩn bị tải tệp Hero.');
  }
}

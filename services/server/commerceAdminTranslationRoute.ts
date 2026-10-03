import 'server-only';
import { UUID_PATTERN } from '@/lib/commerce-admin/product-input';
import { isTranslationLocale, parseTranslationMutation } from '@/lib/commerce-admin/translation-input';
import { requireCommerceProductAccess } from './commerceAdminProductAccess';
import { readCommerceTranslation, saveCommerceTranslation } from './commerceAdminTranslations';
import { commerceAdminJson, commerceAdminRouteError } from './commerceAdminRouteResponse';
export type TranslationRouteParams = { id: string; locale: string; variantId?: string };
export async function handleErpTranslationRoute(request: Request, params: Promise<TranslationRouteParams>, write: boolean) {
  try {
    await requireCommerceProductAccess(write ? 'COMMERCE_PRODUCT_MANAGE' : 'COMMERCE_PRODUCT_VIEW');
    const { id, locale, variantId } = await params;
    if (!UUID_PATTERN.test(id) || !isTranslationLocale(locale) || variantId !== undefined && !UUID_PATTERN.test(variantId)) return commerceAdminJson({ success: false, message: 'Mã sản phẩm hoặc ngôn ngữ không hợp lệ.' }, { status: 400 });
    const target = { productId: id, variantId: variantId ?? null, locale };
    const mutation = write ? parseTranslationMutation(await request.json().catch(() => null)) : null;
    if (write && !mutation) return commerceAdminJson({ success: false, message: 'Vui lòng kiểm tra nội dung bản dịch.' }, { status: 400 });
    const translation = mutation ? await saveCommerceTranslation(target, mutation) : await readCommerceTranslation(target);
    return commerceAdminJson({ success: true, translation });
  } catch (error) { return commerceAdminRouteError(error, 'Không thể đọc hoặc lưu bản dịch.'); }
}

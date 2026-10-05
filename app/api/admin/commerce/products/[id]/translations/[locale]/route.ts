import { handleErpTranslationRoute, type TranslationRouteParams } from '@/services/server/commerceAdminTranslationRoute';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<TranslationRouteParams> };
export function GET(request: Request, { params }: Props) { return handleErpTranslationRoute(request, params, false); }
export function PATCH(request: Request, { params }: Props) { return handleErpTranslationRoute(request, params, true); }

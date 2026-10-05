import { handleErpMedia } from '@/services/server/commerceAdminMediaRoute';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string; variantId?: string }> };
export async function POST(request: Request, { params }: Props) { return handleErpMedia(request, params, true); }

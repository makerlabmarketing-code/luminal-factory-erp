import { handleERPColorway } from '@/services/server/commerceAdminColorwayRoute';
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; variantId: string }> }) { return handleERPColorway(request, params); }

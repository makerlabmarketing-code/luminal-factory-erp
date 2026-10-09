import { listCommerceRaffleEntries } from '@/services/server/commerceAdminRaffles';
import { commerceAdminJson, commerceAdminRouteError } from '@/services/server/commerceAdminRouteResponse';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, {params}: {params: Promise<{id:string}>}) {
  try { return commerceAdminJson({success:true,entries:await listCommerceRaffleEntries((await params).id)}); }
  catch(error) { return commerceAdminRouteError(error,'Không thể tải người tham gia raffle.'); }
}

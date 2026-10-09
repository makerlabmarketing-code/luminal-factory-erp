import { listCommerceRaffles } from '@/services/server/commerceAdminRaffles';
import RaffleManager from './RaffleManager';
export const dynamic = 'force-dynamic';
export default async function RafflesPage() {
  try { return <RaffleManager raffles={await listCommerceRaffles()} />; }
  catch { return <div className="admin-page"><h1 className="admin-page-title">Raffle</h1><p role="alert" className="admin-card p-5 mt-4">Không thể tải raffle. Kiểm tra quyền xem raffle và kết nối Commerce.</p></div>; }
}

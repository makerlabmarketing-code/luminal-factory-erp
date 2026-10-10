import Link from 'next/link';
import { getCommerceRaffleInformation } from '@/services/server/commerceAdminRaffles';
import { hasPermission, requireWorkspaceAccess } from '@/services/server/auth';
import RaffleInformationEditor from './RaffleInformationEditor';
export const dynamic = 'force-dynamic';
export default async function RaffleDetailPage({params}: {params: Promise<{id:string}>}) {
  try {
    const context = await requireWorkspaceAccess('ADMIN_WORKSPACE');
    const [information,canManage] = await Promise.all([
      getCommerceRaffleInformation((await params).id),hasPermission(context,'COMMERCE_RAFFLE_MANAGE'),
    ]);
    return <RaffleInformationEditor {...information} canManage={canManage} />;
  } catch {
    return <div className="admin-page"><h1 className="admin-page-title">Chi tiết raffle</h1><p role="alert">Không thể tải raffle. Kiểm tra mã raffle, quyền truy cập và kết nối.</p><Link className="admin-button-secondary" href="/admin/commerce/raffles" prefetch={false}>Về danh sách</Link></div>;
  }
}

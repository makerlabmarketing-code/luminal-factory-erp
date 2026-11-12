'use client';

import { usePathname } from 'next/navigation';
import { CenteredPageLoading } from '@/component/LuminalLoader';
import AdminListLoading, { isAdminListRoute } from '@/component/data-table/AdminListLoading';
import AttendanceLoading from './admin/attendance/loading';

export default function RootLoading() {
  const pathname = usePathname();

  if (pathname === '/admin/attendance') return <AttendanceLoading />;
  if (pathname && isAdminListRoute(pathname)) return <AdminListLoading route={pathname} />;

  return <CenteredPageLoading />;
}

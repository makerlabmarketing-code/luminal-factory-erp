import { redirect } from 'next/navigation';

export default function AdminAccountsPage() {
  redirect('/admin/employees?tab=permissions');
}

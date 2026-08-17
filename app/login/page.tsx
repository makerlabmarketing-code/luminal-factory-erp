import { redirect } from 'next/navigation';
import AdminLoginForm from '@/app/admin/AdminLoginForm';
import { createClient } from '@/utils/supabase/server';
import { isSafeInternalRedirectPath } from '@/utils/auth/flow';

interface SharedLoginPageProps {
  searchParams?: Promise<{ next?: string | string[] }>;
}

export default async function SharedLoginPage(props: SharedLoginPageProps) {
  const searchParams = await props.searchParams;
  const requestedPath = Array.isArray(searchParams?.next)
    ? searchParams?.next[0]
    : searchParams?.next;
  const nextPath = isSafeInternalRedirectPath(requestedPath) ? requestedPath : undefined;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (!error && data.user) {
    const query = nextPath ? `?next=${encodeURIComponent(nextPath)}` : '';
    redirect(`/auth/workspace-redirect${query}`);
  }

  return (
    <AdminLoginForm
      message="Vui lòng đăng nhập bằng tài khoản ERP."
      nextPath={nextPath}
    />
  );
}

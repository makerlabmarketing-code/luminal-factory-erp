import UpdatePasswordForm from './UpdatePasswordForm';

interface UpdatePasswordPageProps {
  searchParams?: Promise<{
    error?: string;
    error_code?: string;
    mode?: 'invite' | 'recovery';
  }>;
}

export default async function UpdatePasswordPage(props: UpdatePasswordPageProps) {
  const searchParams = await props.searchParams;
  return (
    <UpdatePasswordForm
      initialUrlState={{
        error: searchParams?.error,
        errorCode: searchParams?.error_code,
        mode: searchParams?.mode,
      }}
    />
  );
}

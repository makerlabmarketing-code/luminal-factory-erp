import UpdatePasswordForm from './UpdatePasswordForm';

interface UpdatePasswordPageProps {
  searchParams?: {
    error?: string;
    error_code?: string;
    mode?: 'invite' | 'recovery';
  };
}

export default function UpdatePasswordPage({ searchParams }: UpdatePasswordPageProps) {
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

import { redirect } from 'next/navigation';

export default async function WorkerPortal(
  props: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
  }
) {
  const searchParams = await props.searchParams;
  const params = new URLSearchParams();

  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
      return;
    }

    if (value !== undefined) params.set(key, value);
  });

  const queryString = params.toString();
  redirect(queryString ? `/staff?${queryString}` : '/staff');
}

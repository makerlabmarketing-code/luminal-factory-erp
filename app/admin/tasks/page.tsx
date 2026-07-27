import { redirect } from 'next/navigation';

type LegacyTasksPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

/** Compatibility entry point. Project configuration now has one canonical workspace. */
export default function LegacyTasksPage({ searchParams = {} }: LegacyTasksPageProps) {
  const query = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((entry) => query.append(key, entry));
    else if (value !== undefined) query.set(key, value);
  });

  const suffix = query.toString();
  redirect(`/admin/projects${suffix ? `?${suffix}` : ''}`);
}

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error('Thiếu cấu hình NEXT_PUBLIC_SUPABASE_URL.');
  }

  return url;
}

export function getSupabasePublicKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!key) {
    throw new Error(
      'Thiếu Supabase publishable key. Hãy cấu hình NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    );
  }

  return key;
}

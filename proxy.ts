import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/middleware';

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/staff/portal') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/staff';
    return NextResponse.redirect(redirectUrl, 308);
  }

  const { supabase, response } = createClient(request);

  const { data, error } = await supabase.auth.getUser();

  if (request.nextUrl.pathname.startsWith('/staff') && (error || !data.user)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set(
      'next',
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    );
    const redirectResponse = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

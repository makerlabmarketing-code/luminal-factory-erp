import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  UPDATE_PASSWORD_PATH,
  buildUpdatePasswordRedirectPath,
  getRequestBaseUrl,
  parseAuthCallbackAction,
  resolveAuthPasswordMode,
  type AuthPasswordMode,
} from '@/utils/auth/flow';

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, getRequestBaseUrl(request.url)));
}

function redirectWithError(request: NextRequest, mode: AuthPasswordMode, errorCode = 'invalid_link') {
  const params = new URLSearchParams({
    mode,
    error: 'access_denied',
    error_code: errorCode,
  });

  return redirectTo(request, `${UPDATE_PASSWORD_PATH}?${params.toString()}`);
}

async function hasVerifiedSession(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.auth.getUser();

  return !error && Boolean(data.user);
}

function bridgeImplicitFragment(request: NextRequest) {
  const mode = resolveAuthPasswordMode(new URL(request.url).searchParams.get('mode'));
  const destination = buildUpdatePasswordRedirectPath(mode);
  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Đang xác minh liên kết</title>
</head>
<body>
  <p>Đang xác minh liên kết.</p>
  <script>
    (async function () {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');
      const error = hash.get('error');
      const errorCode = hash.get('error_code') || error || 'invalid_link';
      const type = hash.get('type') || '${mode}';
      const mode = type === 'invite' ? 'invite' : '${mode}';
      const fail = '/auth/update-password?mode=' + encodeURIComponent(mode) + '&error=access_denied&error_code=' + encodeURIComponent(errorCode);

      window.history.replaceState(null, '', '/auth/callback');

      if (error || !accessToken || !refreshToken) {
        window.location.replace(fail);
        return;
      }

      try {
        const response = await fetch('/auth/callback/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'include',
          cache: 'no-store',
          body: JSON.stringify({
            accessToken,
            refreshToken,
            mode,
          }),
        });

        if (!response.ok) {
          window.location.replace(fail);
          return;
        }

        window.location.replace('${destination}');
      } catch (_error) {
        window.location.replace(fail);
      }
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function hasQueryAuthPayload(searchParams: URLSearchParams) {
  return Boolean(
    searchParams.get('error') ||
      searchParams.get('code') ||
      searchParams.get('token_hash') ||
      searchParams.get('access_token') ||
      searchParams.get('refresh_token')
  );
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const action = parseAuthCallbackAction(requestUrl.searchParams);

  if (action.kind === 'error') {
    if (!hasQueryAuthPayload(requestUrl.searchParams)) return bridgeImplicitFragment(request);

    return redirectWithError(request, action.mode, action.errorCode);
  }

  const supabase = await createClient();

  if (action.kind === 'code') {
    const { error } = await supabase.auth.exchangeCodeForSession(action.code);
    if (error || !(await hasVerifiedSession(supabase))) {
      return redirectWithError(request, action.mode, error?.code || 'exchange_failed');
    }

    return redirectTo(request, action.redirectPath || buildUpdatePasswordRedirectPath(action.mode));
  }

  if (action.kind === 'otp') {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: action.tokenHash,
      type: action.type,
    });

    if (error || !(await hasVerifiedSession(supabase))) {
      return redirectWithError(request, action.mode, error?.code || 'otp_failed');
    }

    return redirectTo(request, action.redirectPath || buildUpdatePasswordRedirectPath(action.mode));
  }

  if (action.kind === 'session') {
    const { error } = await supabase.auth.setSession({
      access_token: action.accessToken,
      refresh_token: action.refreshToken,
    });
    if (error || !(await hasVerifiedSession(supabase))) {
      return redirectWithError(request, action.mode, error?.code || 'session_failed');
    }

    return redirectTo(request, action.redirectPath || buildUpdatePasswordRedirectPath(action.mode));
  }

  return redirectWithError(request, resolveAuthPasswordMode(null));
}

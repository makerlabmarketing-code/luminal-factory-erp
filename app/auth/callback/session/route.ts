import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { resolveAuthPasswordMode } from '@/utils/auth/flow';

interface SessionPayload {
  accessToken?: unknown;
  refreshToken?: unknown;
  mode?: unknown;
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');

  return response;
}

function cleanToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

export async function POST(request: NextRequest) {
  const payload = ((await request.json().catch(() => null)) || {}) as SessionPayload;
  const accessToken = cleanToken(payload.accessToken);
  const refreshToken = cleanToken(payload.refreshToken);
  const mode = resolveAuthPasswordMode(typeof payload.mode === 'string' ? payload.mode : null);

  if (!accessToken || !refreshToken) {
    return jsonNoStore(
      {
        success: false,
        mode,
        message: 'Liên kết chưa được xác minh.',
      },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    return jsonNoStore(
      {
        success: false,
        mode,
        message: 'Liên kết chưa được xác minh.',
      },
      { status: 401 }
    );
  }

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) {
    return jsonNoStore(
      {
        success: false,
        mode,
        message: 'Liên kết chưa được xác minh.',
      },
      { status: 401 }
    );
  }

  return jsonNoStore({
    success: true,
    mode,
  });
}

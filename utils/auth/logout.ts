export const LOGOUT_MESSAGES = {
  failed: 'Không thể đăng xuất. Vui lòng thử lại.',
} as const;

interface LocalSignOutAuthClient {
  signOut(options: { scope: 'local' }): Promise<{
    error?: unknown;
  }>;
}

type SignOutCurrentDeviceResult =
  | { ok: true }
  | { ok: false; message: string };

export async function signOutCurrentDevice(
  auth: LocalSignOutAuthClient,
): Promise<SignOutCurrentDeviceResult> {
  const { error } = await auth.signOut({ scope: 'local' });

  if (error) {
    return {
      ok: false,
      message: LOGOUT_MESSAGES.failed,
    };
  }

  return {
    ok: true,
  };
}

export function navigateAfterLogout(path = '/') {
  window.location.replace(path);
}

import { NextResponse } from 'next/server';
import { AuthFlowError, hasPermission, requireWorkspaceAccess } from '@/services/server/auth';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');

  return response;
}

async function requireFinanceView() {
  const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE', {
    allowLegacyAdminFallback: true,
  });
  if (!(await hasPermission(authContext, 'FINANCE_VIEW'))) {
    throw new AuthFlowError({
      status: 403,
      code: 'permission_forbidden',
      message: 'Bạn không có quyền xem cấu hình tài chính.',
      failureStage: 'permission_check',
    });
  }
}

export async function GET() {
  try {
    await requireFinanceView();

    return jsonNoStore({
      companyBankCode: process.env.COMPANY_BANK_CODE || 'MB',
      companyBankAccount: process.env.COMPANY_BANK_ACCOUNT || '',
    });
  } catch (error) {
    const status = error instanceof AuthFlowError ? error.status : 500;

    return jsonNoStore(
      {
        error:
          status === 401
            ? 'Phiên đăng nhập đã hết hạn.'
            : status === 403
              ? 'Bạn không có quyền xem cấu hình tài chính.'
              : 'Không tải được cấu hình tài chính.',
      },
      { status }
    );
  }
}

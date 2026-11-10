import { NextResponse } from 'next/server';
import { AuthFlowError, hasPermission, isSystemOwner, requireWorkspaceAccess } from '@/services/server/auth';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function authorize(permission: 'FINANCE_VIEW' | 'FINANCE_UPDATE') {
  const auth = await requireWorkspaceAccess('ADMIN_WORKSPACE', { allowLegacyAdminFallback: true });
  if (!isSystemOwner(auth.employee) || !(await hasPermission(auth, permission))) {
    throw new AuthFlowError({
      status: 403,
      code: 'permission_forbidden',
      message: 'Bạn không có quyền cấu hình góp vốn.',
      failureStage: 'permission_check',
    });
  }
  return auth;
}

export async function GET() {
  try {
    await authorize('FINANCE_VIEW');
    const { data, error } = await createSupabaseAdminClient().rpc('list_monthly_capital_rates');
    if (error) return response({ error: 'Không tải được mức góp vốn.' }, 503);
    return response({ rates: data });
  } catch (error) {
    return error instanceof AuthFlowError
      ? response({ error: error.message }, error.status)
      : response({ error: 'Không tải được mức góp vốn.' }, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await authorize('FINANCE_UPDATE');
    const body = await request.json().catch(() => null);
    const employeeId = body?.employeeId;
    const amount = body?.amount;
    const expectedAt = body?.expectedAt;
    if (!Number.isSafeInteger(employeeId) || employeeId <= 0 ||
        !Number.isSafeInteger(amount) || amount < 1 || amount > 999999999999 ||
        typeof expectedAt !== 'string' || !Number.isFinite(Date.parse(expectedAt))) {
      return response({ error: 'Mức góp vốn không hợp lệ.' }, 400);
    }

    const { data, error } = await createSupabaseAdminClient().rpc('set_monthly_capital_rate', {
      p_employee_id: employeeId, p_amount: amount, p_actor_id: auth.employee.id, p_expected_at: expectedAt,
    });
    if (error?.code === '40001') return response({ error: 'Mức góp đã thay đổi. Tải lại rồi lưu lại.' }, 409);
    if (error?.code === '22023') return response({ error: 'Mức góp vốn không hợp lệ.' }, 400);
    if (error) return response({ error: 'Không lưu được mức góp vốn.' }, 503);
    return response({ effectiveMonth: data });
  } catch (error) {
    return error instanceof AuthFlowError
      ? response({ error: error.message }, error.status)
      : response({ error: 'Không lưu được mức góp vốn.' }, 500);
  }
}

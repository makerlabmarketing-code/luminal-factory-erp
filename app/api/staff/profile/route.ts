import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { AuthFlowError, requireWorkspaceAccess } from '@/services/server/auth';

const MAX_PROFILE_FIELD_LENGTH = 120;

function cleanProfileField(value: unknown): string {
  if (typeof value !== 'string') return '';

  return value.trim().slice(0, MAX_PROFILE_FIELD_LENGTH);
}

function toErrorResponse(error: unknown) {
  if (error instanceof AuthFlowError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ error: 'Không thể lưu hồ sơ nhân sự.' }, { status: 500 });
}

export async function PATCH(request: Request) {
  const correlationId = crypto.randomUUID();
  try {
    const authContext = await requireWorkspaceAccess('STAFF_WORKSPACE');
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    if (!body) {
      return NextResponse.json({ error: 'Dữ liệu hồ sơ không hợp lệ.' }, { status: 400 });
    }

    const allowedKeys = new Set(['phone', 'bankName', 'bankAccountNumber']);
    if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
      return NextResponse.json({ error: 'Bạn không được phép cập nhật trường này.', correlationId }, { status: 403 });
    }
    const payload: Record<string, string> = {};
    if (Object.prototype.hasOwnProperty.call(body, 'phone')) payload.phone = cleanProfileField(body.phone);
    if (Object.prototype.hasOwnProperty.call(body, 'bankName')) payload.bank_name = cleanProfileField(body.bankName);
    if (Object.prototype.hasOwnProperty.call(body, 'bankAccountNumber')) payload.bank_account_number = cleanProfileField(body.bankAccountNumber);

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', authContext.employee.id)
      .select('phone, bank_name, bank_account_number')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Không thể lưu hồ sơ nhân sự.', failureStage: 'persistence', correlationId }, { status: 500 });
    }

    return NextResponse.json({ success: true, employee: data, correlationId });
  } catch (error) {
    return toErrorResponse(error);
  }
}

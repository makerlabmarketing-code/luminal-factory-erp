// app/api/cron/capital-call/route.ts
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendTemplateEmailByGroup } from '@/services/emailService';

const CAPITAL_CALL_GROUP = 'CAPITAL_CALL';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    // 1. Lấy danh sách các sếp/quản lý (Có quyền nạp vốn)
    const { data: managers } = await supabase.from('employees').select('email, full_name').or('role.eq.ADMIN,is_manager.eq.true');
    if (!managers || managers.length === 0) return NextResponse.json({ message: 'Không có quản lý nào.' });

    for (const manager of managers) {
      if (!manager.email) continue;

      await sendTemplateEmailByGroup({
        groupType: CAPITAL_CALL_GROUP,
        recipient: manager.email,
        variables: {
          hoTen: manager.full_name || 'Quản lý',
        },
      });
    }

    return NextResponse.json({ success: true, message: 'Đã bắn lệnh gọi vốn tự động thành công!' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi thực thi ngầm!';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// app/api/attendance/check-out/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeId, userLat, userLng } = body;

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Thiếu thông tin xác thực nhân sự!' },
        { status: 400 }
      );
    }

    // 1. Tìm bản ghi Check-in gần nhất trong ngày chưa có thời gian Check-out của Nhân sự này
    const { data: currentLog, error: logError } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('employee_id', employeeId)
      .is('check_out_time', null)
      .order('check_in_time', { ascending: false })
      .maybeSingle();

    if (logError || !currentLog) {
      return NextResponse.json(
        {
          error:
            'Không tìm thấy dữ liệu vào ca (Check-in) hợp lệ của bạn trong hôm nay!',
        },
        { status: 404 }
      );
    }

    // 2. Lấy mốc thời gian thực tế
    const checkInTime = new Date(currentLog.check_in_time);
    const checkOutTime = new Date(); // Thời gian bấm nút hiện tại

    // 3. THUẬT TOÁN TÍNH GIỜ: Tính độ lệch khoảng cách mili-giây và quy đổi sang Giờ (Hours)
    const timeDifferenceMs = checkOutTime.getTime() - checkInTime.getTime();

    // Quy đổi: 1 giờ = 3.600.000 mili-giây. Làm tròn đến 2 chữ số thập phân (Ví dụ: làm 4.5 tiếng)
    const hoursWorked = Number(
      (timeDifferenceMs / (1000 * 60 * 60)).toFixed(2)
    );

    if (hoursWorked <= 0) {
      return NextResponse.json(
        { error: 'Thời gian ca làm quá ngắn để ghi nhận!' },
        { status: 400 }
      );
    }

    // 4. Lấy mức lương cấu hình theo giờ của Nhân sự này để tính tổng tiền phát sinh trong ngày
    const { data: employee } = await supabase
      .from('employees')
      .select('hourly_rate')
      .eq('id', employeeId)
      .single();

    const hourlyRate = employee?.hourly_rate || 30000;
    const totalEarningsToday = Math.round(hoursWorked * hourlyRate);

    // 5. Cập nhật (Update) dữ liệu giờ làm và tiền lương trực tiếp vào dòng log trong Database
    const { error: updateError } = await supabase
      .from('attendance_logs')
      .update({
        check_out_time: checkOutTime.toISOString(),
        hours_worked: hoursWorked,
        earnings_today: totalEarningsToday,
        status: 'COMPLETED',
      })
      .eq('id', currentLog.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: `Check-out thành công! Bạn đã làm việc được ${hoursWorked} giờ. Số tiền tạm tính hôm nay: ${totalEarningsToday.toLocaleString()} đ.`,
    });
  } catch (error) {
    console.error('Check-out System Error:', error);
    return NextResponse.json(
      { error: 'Lỗi máy chủ khi tính toán giờ làm việc!' },
      { status: 500 }
    );
  }
}

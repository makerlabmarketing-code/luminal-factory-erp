import { NextResponse } from 'next/server';

const disabledResponse = () =>
  NextResponse.json(
    {
      success: false,
      code: 'legacy_check_out_disabled',
      message: 'Điểm tan ca cũ đã ngừng hoạt động. Vui lòng sử dụng khu vực nhân viên.',
    },
    {
      status: 410,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );

export async function POST() {
  return disabledResponse();
}

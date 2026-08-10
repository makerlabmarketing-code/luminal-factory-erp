import { NextResponse } from 'next/server';

const disabledResponse = () =>
  NextResponse.json(
    {
      success: false,
      code: 'payment_webhook_disabled',
      message: 'Tự động đối soát thanh toán chưa được kích hoạt.',
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

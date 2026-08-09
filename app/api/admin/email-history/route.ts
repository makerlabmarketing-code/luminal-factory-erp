import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { listEmailHistory } from '@/services/server/emailHistory';

function failure(error: unknown) {
  const status = error instanceof AuthFlowError ? error.status : 500;
  const message = error instanceof Error
    ? error.message
    : 'Không thể tải lịch sử email. Vui lòng thử lại.';

  return NextResponse.json(
    { success: false, message },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const result = await listEmailHistory({
      page: url.searchParams.get('page'),
      pageSize: url.searchParams.get('pageSize'),
      search: url.searchParams.get('search'),
    });

    return NextResponse.json(
      { success: true, ...result },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return failure(error);
  }
}

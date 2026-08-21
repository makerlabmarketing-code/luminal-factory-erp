import { NextRequest, NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { mutatePhaseTemplate } from '@/services/server/phaseTemplates';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonNoStore({ success: false, message: 'Dữ liệu mẫu không hợp lệ.' }, { status: 422 });
    }
    return jsonNoStore(await mutatePhaseTemplate(body as Record<string, unknown>));
  } catch (error) {
    if (error instanceof AuthFlowError) {
      return jsonNoStore({ success: false, message: error.message, code: error.code, failure_stage: error.failureStage }, { status: error.status });
    }
    return jsonNoStore({ success: false, message: 'Không thể cập nhật mẫu giai đoạn.' }, { status: 500 });
  }
}

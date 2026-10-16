import { NextRequest, NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { saveProjectTemplateSnapshot } from '@/services/server/projectTemplateSnapshot';

export async function POST(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!payload || Object.keys(payload).some((key) => key !== 'name') || typeof payload.name !== 'string') {
      return NextResponse.json({ success: false, message: 'Dữ liệu mẫu không hợp lệ.' }, { status: 422 });
    }
    return NextResponse.json(await saveProjectTemplateSnapshot(Number(projectId), payload.name), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof AuthFlowError ? error.message : 'Không thể lưu mẫu. Dự án vẫn được giữ nguyên.' }, { status: error instanceof AuthFlowError ? error.status : 500 });
  }
}

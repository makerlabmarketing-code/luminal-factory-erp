import { NextRequest, NextResponse } from 'next/server';
import { createProjectComment, listProjectTimeline, projectActivityErrorResponse } from '@/services/server/projectActivity';

export const dynamic = 'force-dynamic';

function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } }); }

export async function GET(request: NextRequest, props: { params: Promise<{ projectId: string }> }) {
  const params = await props.params;
  try { return reply(await listProjectTimeline(params.projectId, request.nextUrl.searchParams)); }
  catch (error) { const response = projectActivityErrorResponse(error); return reply(response.body, response.status); }
}

export async function POST(request: NextRequest, props: { params: Promise<{ projectId: string }> }) {
  const params = await props.params;
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ success: false, message: 'Dữ liệu bình luận không hợp lệ.' }, 400);
    return reply(await createProjectComment(params.projectId, body as Record<string, unknown>), 201);
  } catch (error) { const response = projectActivityErrorResponse(error); return reply(response.body, response.status); }
}

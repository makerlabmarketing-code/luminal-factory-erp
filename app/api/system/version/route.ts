import { NextResponse } from 'next/server';

import { getDeploymentMetadata } from '@/lib/deploymentMetadata';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function GET() {
  const metadata = getDeploymentMetadata({
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });

  return jsonNoStore({
    success: metadata.status === 'available',
    ...metadata,
  });
}

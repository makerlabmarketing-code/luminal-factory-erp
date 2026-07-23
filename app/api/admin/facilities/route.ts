import { NextRequest, NextResponse } from 'next/server';

import {
  createAdminFacility,
  deleteAdminFacility,
  listAdminFacilities,
  updateAdminFacility,
} from '@/services/server/adminFacilities';
import { AuthFlowError } from '@/services/server/auth';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function toErrorResponse(error: unknown) {
  if (error instanceof AuthFlowError) {
    return jsonNoStore(
      { success: false, message: error.message, code: error.code, failureStage: error.failureStage },
      { status: error.status }
    );
  }

  return jsonNoStore(
    { success: false, message: 'Không thể xử lý cơ sở làm việc.', code: 'facility_unhandled_failure', failureStage: 'unknown' },
    { status: 500 }
  );
}

async function readBody(request: NextRequest) {
  return ((await request.json().catch(() => null)) || {}) as Record<string, unknown>;
}

export async function GET() {
  try {
    return jsonNoStore(await listAdminFacilities());
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return jsonNoStore(await createAdminFacility(await readBody(request)));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    return jsonNoStore(await updateAdminFacility(await readBody(request)));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    return jsonNoStore(await deleteAdminFacility(await readBody(request)));
  } catch (error) {
    return toErrorResponse(error);
  }
}

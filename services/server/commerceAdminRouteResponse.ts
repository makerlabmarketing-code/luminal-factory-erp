import 'server-only';

import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import {
  CommerceAdminIntegrationError,
} from '@/services/server/commerceAdminIntegration';

export function commerceAdminJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export function commerceAdminRouteError(
  error: unknown,
  fallbackMessage: string,
) {
  if (error instanceof AuthFlowError) {
    return commerceAdminJson(
      { success: false, code: error.code, message: error.message },
      { status: error.status },
    );
  }

  if (error instanceof CommerceAdminIntegrationError) {
    console.warn('[commerce-admin-erp-route]', {
      code: error.code,
      status: error.status,
      requestId: error.requestId ?? null,
    });
    return commerceAdminJson(
      { success: false, code: error.code, message: error.message },
      { status: error.status },
    );
  }

  console.error('[commerce-admin-erp-route]', { code: 'unexpected_error' });
  return commerceAdminJson(
    {
      success: false,
      code: 'commerce_operation_failed',
      message: fallbackMessage,
    },
    { status: 500 },
  );
}

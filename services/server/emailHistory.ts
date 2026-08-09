import 'server-only';

import { AuthFlowError, requirePermission, requireWorkspaceAccess } from './auth';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';

export interface EmailHistoryLogDTO {
  id: number;
  recipient: string | null;
  subject: string | null;
  group_type: string | null;
  body: string | null;
  status: string | null;
  sent_at: string | null;
}

export interface EmailHistoryPageDTO {
  rows: EmailHistoryLogDTO[];
  totalCount: number;
  page: number;
  pageSize: number;
}

const HISTORY_SELECT = 'id, recipient, subject, group_type, body, status, sent_at';
const MAX_SEARCH_LENGTH = 100;
const ALLOWED_PAGE_SIZES = new Set([5, 10, 20, 50]);

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sanitizeHistorySearch(value: string | null) {
  return (value || '')
    .trim()
    .replace(/[(),.%_*]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, MAX_SEARCH_LENGTH);
}

export async function listEmailHistory(params: {
  page: string | null;
  pageSize: string | null;
  search: string | null;
}): Promise<EmailHistoryPageDTO> {
  await requireWorkspaceAccess('ADMIN_WORKSPACE', { allowLegacyAdminFallback: true });
  // Temporary compatibility permission. A dedicated EMAIL_HISTORY_VIEW contract
  // remains intentionally blocked on the documented business decision.
  await requirePermission('EMAIL_TEMPLATE_VIEW');

  const page = positiveInteger(params.page, 1);
  const requestedPageSize = positiveInteger(params.pageSize, 10);
  const pageSize = ALLOWED_PAGE_SIZES.has(requestedPageSize) ? requestedPageSize : 10;
  const search = sanitizeHistorySearch(params.search);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const admin = createSupabaseAdminClient();
  let query = admin
    .from('email_history')
    .select(HISTORY_SELECT, { count: 'exact' })
    .order('id', { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(
      `recipient.ilike.%${search}%,subject.ilike.%${search}%,group_type.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query;
  if (error) {
    console.error('[email-history-server-read]', { code: error.code || 'unknown' });
    throw new AuthFlowError({
      status: 500,
      code: 'service_unavailable',
      message: 'Không thể tải lịch sử email. Vui lòng thử lại.',
      failureStage: 'persistence',
    });
  }

  return {
    rows: (data || []) as EmailHistoryLogDTO[],
    totalCount: count || 0,
    page,
    pageSize,
  };
}

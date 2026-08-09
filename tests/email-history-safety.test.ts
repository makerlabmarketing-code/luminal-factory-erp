import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const page = fs.readFileSync(path.resolve('app/admin/email-history/page.tsx'), 'utf8');
const route = fs.readFileSync(path.resolve('app/api/admin/email-history/route.ts'), 'utf8');
const server = fs.readFileSync(path.resolve('services/server/emailHistory.ts'), 'utf8');

describe('email history protected read boundary', () => {
  it('moves history reads behind the server boundary with bounded fields and rows', () => {
    expect(server).toContain("const HISTORY_SELECT = 'id, recipient, subject, group_type, body, status, sent_at'");
    expect(server).toContain(".select(HISTORY_SELECT, { count: 'exact' })");
    expect(server).toContain('.range(from, to)');
    expect(server).not.toContain("select('*')");
    expect(page).toContain("fetch(`/api/admin/email-history?");
    expect(page).not.toContain("@/utils/supabase/client");
  });

  it('requires an Admin workspace and the existing compatibility view permission', () => {
    expect(server).toContain("requireWorkspaceAccess('ADMIN_WORKSPACE'");
    expect(server).toContain("requirePermission('EMAIL_TEMPLATE_VIEW')");
    expect(server).toContain('createSupabaseAdminClient()');
    expect(route).toContain("'Cache-Control': 'no-store'");
  });

  it('keeps history UI read-only while archive, retry, and purge semantics are undecided', () => {
    expect(page).toContain('Lịch sử đang ở chế độ chỉ đọc');
    expect(page).not.toContain(".from('email_history').delete()");
    expect(page).not.toContain('Trash2');
    expect(route).not.toContain('export async function DELETE');
    expect(route).not.toContain('export async function POST');
  });

  it('uses controlled load errors and stale-response protection', () => {
    expect(page).toContain("const HISTORY_LOAD_ERROR = 'Không thể tải lịch sử email. Vui lòng thử lại.'");
    expect(page).toContain('requestId !== latestRequestRef.current');
    expect(server).toContain("message: 'Không thể tải lịch sử email. Vui lòng thử lại.'");
  });
});

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const page = fs.readFileSync(path.resolve('app/admin/email-history/page.tsx'), 'utf8');

describe('email history safe list boundary', () => {
  it('bounds selected fields and rows instead of loading the whole history table', () => {
    expect(page).toContain("const HISTORY_SELECT = 'id, recipient, subject, group_type, body, status, sent_at'");
    expect(page).toContain(".select(HISTORY_SELECT, { count: 'exact' })");
    expect(page).toContain('.range(from, to)');
    expect(page).not.toContain("select('*')");
  });

  it('does not expose raw Supabase errors and ignores stale list responses', () => {
    expect(page).toContain("const HISTORY_LOAD_ERROR = 'Không thể tải lịch sử email. Vui lòng thử lại.'");
    expect(page).toContain('requestId !== latestRequestRef.current');
    expect(page).not.toContain('setDbError(error.message)');
  });

  it('locks concurrent delete requests without changing the existing delete operation', () => {
    expect(page).toContain('if (deletingId !== null) return');
    expect(page).toContain(".from('email_history').delete().eq('id', id)");
    expect(page).toContain('disabled={deletingId !== null}');
  });
});

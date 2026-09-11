import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const routeSource = readFileSync(
  join(__dirname, '../app/api/cron/attendance-checkout-reminder/route.ts'),
  'utf8'
);

describe('attendance checkout reminder cron security boundary', () => {
  it('requires the server-side cron secret and disables caching', () => {
    expect(routeSource).toMatch(/process\.env\.CRON_SECRET/);
    expect(routeSource).toMatch(/authorization/);
    expect(routeSource).toMatch(/Bearer \$\{cronSecret\}/);
    expect(routeSource).toMatch(/Cache-Control', 'no-store'/);
  });

  it('keeps recipient identity and provider errors out of API responses', () => {
    expect(routeSource).toMatch(/skippedCount/);
    expect(routeSource).not.toMatch(/skipped:\s*string\[\]/);
    expect(routeSource).not.toMatch(/candidate\.employee\.full_name.*message/);
    expect(routeSource).not.toMatch(/error instanceof Error \? error\.message/);
  });

  it('returns a stable safe error contract on unexpected failures', () => {
    expect(routeSource).toMatch(/attendance_checkout_reminder_failed/);
    expect(routeSource).toMatch(/Không thể hoàn tất tác vụ nhắc checkout\./);
    expect(routeSource).toMatch(/status: 500/);
  });
});

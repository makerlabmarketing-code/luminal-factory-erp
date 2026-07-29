import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');
const source = (relativePath: string) => readFileSync(join(repositoryRoot, relativePath), 'utf8');

describe('notification workspace isolation', () => {
  it('mounts exactly one notification provider inside each workspace layout', () => {
    const rootLayout = source('app/layout.tsx');
    const adminLayout = source('app/admin/layout.tsx');
    const staffLayout = source('app/staff/layout.tsx');

    expect(rootLayout).not.toContain('NotificationProvider');
    expect(adminLayout.match(/<NotificationProvider workspace="admin">/g)).toHaveLength(1);
    expect(staffLayout.match(/<NotificationProvider workspace="staff">/g)).toHaveLength(1);
  });

  it('clears transient timers when a workspace provider unmounts', () => {
    const provider = source('component/NotificationContext.tsx');

    expect(provider).toContain('toastTimers.current.forEach((timer) => window.clearTimeout(timer))');
    expect(provider).toContain('toastTimers.current.clear()');
    expect(provider).toContain('data-notification-workspace={workspace}');
    expect(provider).toContain('toasts.map((toast) =>');
    expect(provider).toContain('zIndex: OVERLAY_Z_INDEX.notification');
  });
});

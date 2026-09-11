import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const source = (path: string) => readFileSync(join(root, path), 'utf8');

describe('system record lifecycle contract', () => {
  it('ships a guarded schema package without browser grants', () => {
    const migration = source('supabase/migrations/20260910090000_system_record_lifecycle.sql');
    const preflight = source('supabase/validation/20260910090000_system_record_lifecycle_pre_run.sql');
    const validation = source('supabase/validation/20260910090000_system_record_lifecycle_validation.sql');
    const rollback = source('supabase/rollbacks/20260910090000_system_record_lifecycle_rollback.sql');

    for (const table of ['email_templates', 'system_metadata']) {
      expect(migration).toContain(`alter table public.${table}`);
    }
    expect(migration).toMatch(/is_active boolean not null default true/);
    expect(migration).toMatch(/deactivated_by_employee_id.*references public\.employees\(id\) on delete set null/s);
    expect(migration).toMatch(/lifecycle_consistent/);
    expect(migration).not.toMatch(/create policy|grant\s/i);
    expect(preflight).toMatch(/set transaction read only/);
    expect(validation).toMatch(/set transaction read only/);
    expect(rollback).toMatch(/Rollback blocked: inactive system records exist/);
  });

  it('defaults to active rows and keeps permanent deletion owner-only', () => {
    for (const routePath of ['app/api/admin/email-templates/route.ts', 'app/api/admin/system-metadata/route.ts']) {
      const route = source(routePath);
      expect(route).toMatch(/includeInactive/);
      expect(route).toMatch(/\.eq\('is_active', true\)/);
      expect(route).toMatch(/lifecycleAction === 'DEACTIVATE'/);
      expect(route).toMatch(/deactivated_by_employee_id: activating \? null : authContext\.employee\.id/);
      expect(route).toMatch(/\.eq\('is_active', !activating\)/);
      expect(route).toMatch(/export async function DELETE[\s\S]*requireSystemOwner\(\)/);
      expect(route).toMatch(/deleteQuery = deleteQuery\.eq\('is_active', false\)/);
    }
  });

  it('excludes inactive records from every new operational choice', () => {
    const bank = source('services/server/bankDirectory.ts');
    const finance = source('services/server/adminFinancialLedger.ts');
    const email = source('services/emailService.ts');
    const capital = source('app/admin/capital/page.tsx');

    for (const serverSource of [bank, finance, email]) {
      expect(serverSource).toMatch(/SYSTEM_RECORD_LIFECYCLE_ENABLED/);
      expect(serverSource).toMatch(/\.eq\('is_active', true\)/);
    }
    expect(capital).not.toMatch(/from\('system_metadata'\)/);
    expect(capital).toMatch(/ledgerResult\.transactionTypes/);
    expect(capital).toMatch(/ledgerResult\.contributionTypes/);
  });

  it('shows inactive records only on request and disables their editing', () => {
    const emailPage = source('app/admin/email-editor/page.tsx');
    const metadataPage = source('app/admin/metadata/page.tsx');

    for (const page of [emailPage, metadataPage]) {
      expect(page).toMatch(/showInactive/);
      expect(page).toMatch(/includeInactive=true/);
      expect(page).toMatch(/Hiện ngừng hoạt động/);
      expect(page).toMatch(/Kích hoạt lại/);
    }
    expect(emailPage).toMatch(/t\.is_active !== false && <button onClick=\{\(\) => handleOpenEdit/);
    expect(metadataPage).toMatch(/activeCategory\?\.is_active === false/);
  });
});

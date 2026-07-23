import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const packageDir = 'supabase/drafts/corrective-slice-6-production-order-persistence';
const migrationPath = 'supabase/migrations/20260722110928_corrective_slice_6_production_order_persistence.sql';
const source = (file: string) => readFileSync(join(root, packageDir, file), 'utf8');
const migration = () => readFileSync(join(root, migrationPath), 'utf8');
const promotedForwardFiles = [
  'forward.sql',
  'notification-outbox.sql',
  'compatibility.sql',
  'attachment-policy.sql',
  'security/RLS.sql',
];
const asApprovedMigrationSection = (file: string) =>
  source(file).replaceAll(
    '-- DRAFT ONLY - DO NOT RUN WITHOUT LIVE_APPROVAL_REQUIRED.\n',
    '-- APPROVED FOR GITHUB INTEGRATION DELIVERY AFTER PROTECTED PR MERGE.\n',
  );

describe('Corrective Slice 6 production-order persistence package', () => {
  it('promotes only the reviewed forward package into the canonical GitHub Integration migration', () => {
    const canonical = migration();

    expect(canonical).toMatch(/Supabase GitHub Integration after protected main-branch merge/);
    expect(canonical).toMatch(/Rollback and validation remain separate artifacts/);
    expect(canonical).not.toMatch(/DRAFT ONLY|DO NOT RUN WITHOUT LIVE_APPROVAL_REQUIRED/);
    expect(canonical).not.toMatch(/Corrective Slice 6 .* rollback reviewed package/);
    expect(canonical).not.toMatch(/Corrective Slice 6 .* validation reviewed package/);

    promotedForwardFiles.forEach((file) => {
      expect(canonical).toContain(`-- BEGIN REVIEWED PACKAGE: ${file}`);
      expect(canonical).toContain(asApprovedMigrationSection(file).trim());
      expect(canonical).toContain(`-- END REVIEWED PACKAGE: ${file}`);
    });
  });

  it('keeps unapproved SQL and unsafe database mutations out of the canonical migration', () => {
    const canonical = migration();
    const migrationFiles = [
      'forward.sql',
      'compatibility.sql',
      'attachment-policy.sql',
      'notification-outbox.sql',
      'security/RLS.sql',
    ];

    expect(canonical).not.toMatch(/drop table|drop function|drop policy|delete\s+from|truncate\s+/i);
    expect(canonical).not.toMatch(/rollback blocked/i);
    expect(canonical).not.toMatch(/validation_result|check_name/i);
    expect(canonical).not.toMatch(/update\s+public\.inventory|insert\s+into\s+public\.procurement|decrement_stock/i);

    migrationFiles.forEach((file) => {
      expect(canonical).toContain(asApprovedMigrationSection(file).trim());
    });
  });

  it('contains every reviewed draft artifact without executing live SQL', () => {
    [
      'forward.sql',
      'rollback.sql',
      'validation.sql',
      'compatibility.sql',
      'security/RLS.sql',
      'attachment-policy.sql',
      'notification-outbox.sql',
      'backfill-plan.md',
      'REVIEW.md',
    ].forEach((artifact) => expect(existsSync(join(root, packageDir, artifact))).toBe(true));

    expect(source('forward.sql')).toMatch(/DRAFT ONLY - DO NOT RUN WITHOUT LIVE_APPROVAL_REQUIRED/);
    expect(source('validation.sql')).toMatch(/READ ONLY/);
  });

  it('persists production orders, templates, stages, members, dependencies, activity, attachment metadata and notification context', () => {
    const forward = source('forward.sql');

    expect(forward).toMatch(/create table if not exists public\.production_orders/);
    expect(forward).toMatch(/create table if not exists public\.production_workflow_templates/);
    expect(forward).toMatch(/create table if not exists public\.production_workflow_template_stages/);
    expect(forward).toMatch(/create table if not exists public\.production_stages/);
    expect(forward).toMatch(/create table if not exists public\.production_order_members/);
    expect(forward).toMatch(/create table if not exists public\.production_stage_dependencies/);
    expect(forward).toMatch(/create table if not exists public\.production_attachment_metadata/);
    expect(forward).toMatch(/alter table public\.project_activity[\s\S]*production_order_id/);
    expect(forward).toMatch(/alter table public\.task_notifications[\s\S]*dedupe_key/);
  });

  it('reuses existing project, phase, task, member, activity and notification foundations', () => {
    const forward = source('forward.sql');
    const notificationOutbox = source('notification-outbox.sql');

    expect(forward).toMatch(/references public\.projects\(id\)/);
    expect(forward).toMatch(/references public\.phases\(id\)/);
    expect(forward).toMatch(/references public\.tasks\(id\)/);
    expect(forward).toMatch(/references public\.project_members\(id\)/);
    expect(forward).not.toMatch(/create table if not exists public\.production_tasks/);
    expect(forward).not.toMatch(/create table if not exists public\.production_notifications/);
    expect(notificationOutbox).toMatch(/Reuses public\.task_notifications/);
  });

  it('keeps production-code unique while allowing duplicate display names and preserving template version', () => {
    const forward = source('forward.sql');

    expect(forward).toMatch(/production_orders_code_unique_idx[\s\S]*upper\(btrim\(production_code\)\)/);
    expect(forward).toMatch(/display_name text null/);
    expect(forward).not.toMatch(/display_name[^\n]*unique/i);
    expect(forward).toMatch(/workflow_template_version integer null/);
  });

  it('keeps mutations behind RPC/RLS boundaries and avoids public browser writes', () => {
    const forward = source('forward.sql');
    const rls = source('security/RLS.sql');
    const validation = source('validation.sql');

    expect(forward).toMatch(/create or replace function public\.create_production_order_atomic\(p_payload jsonb\)/);
    expect(forward).toMatch(/create or replace function public\.transition_production_stage_atomic\(p_payload jsonb\)/);
    expect(forward).toMatch(/security definer/);
    expect(forward).toMatch(/public\.current_employee_id\(\)/);
    expect(forward).toMatch(/public\.has_permission\('TASK_MANAGE'\)/);
    expect(forward).toMatch(/public\.has_permission\('TASK_REVIEW'\)/);
    expect(rls).toMatch(/revoke all on public\.production_orders from public, anon, authenticated/);
    expect(rls).not.toMatch(/for (insert|update|delete|all)[\s\S]*to anon/i);
    expect(validation).toMatch(/no_broad_authenticated_write_policies/);
  });

  it('documents protected attachments, notification deduplication, guarded rollback, no guessed backfill and no inventory mutation', () => {
    expect(source('attachment-policy.sql')).toMatch(/does not create public storage/);
    expect(source('notification-outbox.sql')).toMatch(/dedupe_key/);
    expect(source('rollback.sql')).toMatch(/Rollback blocked/);
    expect(source('backfill-plan.md')).toMatch(/No automatic legacy production-order backfill/);

    const packageText = [
      source('forward.sql'),
      source('validation.sql'),
      source('backfill-plan.md'),
      source('REVIEW.md'),
    ].join('\n');
    expect(packageText).not.toMatch(/update\s+public\.inventory|insert\s+into\s+public\.procurement|decrement_stock/i);
    expect(packageText).toMatch(/material_requirements/);
    expect(packageText).toMatch(/no inventory quantity/i);
  });
});

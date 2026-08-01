import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { attendanceRecoveryStatus, isAttendanceRecoveryEnabled } from '../lib/attendanceRecoveryGate';
import { getDeploymentMetadata } from '../lib/deploymentMetadata';

const root = join(__dirname, '..');
const source = (path: string) => readFileSync(join(root, path), 'utf8');

describe('read-only runtime verification contracts', () => {
  it.each([
    ['true', 'enabled'],
    ['false', 'disabled'],
    [undefined, 'disabled'],
    ['TRUE', 'disabled'],
    ['1', 'disabled'],
  ] as const)('normalizes recovery value %s to %s', (value, expected) => {
    expect(attendanceRecoveryStatus(value)).toBe(expected);
    expect(isAttendanceRecoveryEnabled(value)).toBe(expected === 'enabled');
  });

  it('accepts only a valid immutable commit SHA and safe Vercel environment label', () => {
    expect(getDeploymentMetadata({
      VERCEL_GIT_COMMIT_SHA: 'A'.repeat(40),
      VERCEL_ENV: 'production',
    })).toEqual({
      status: 'available',
      commitSha: 'a'.repeat(40),
      deploymentEnvironment: 'production',
    });
    expect(getDeploymentMetadata({ VERCEL_GIT_COMMIT_SHA: 'not-a-sha', VERCEL_ENV: 'production' })).toEqual({
      status: 'unavailable',
      commitSha: null,
      deploymentEnvironment: 'production',
    });
  });

  it('returns unavailable metadata without exposing environment contents', () => {
    const metadata = getDeploymentMetadata({});
    expect(metadata).toEqual({ status: 'unavailable', commitSha: null, deploymentEnvironment: null });
    const versionRoute = source('app/api/system/version/route.ts');
    expect(versionRoute).toContain("Cache-Control', 'no-store, max-age=0'");
    expect(versionRoute).not.toMatch(/Object\.keys\(process\.env\)|JSON\.stringify\(process\.env\)/);
    expect(versionRoute).not.toMatch(/SUPABASE|DATABASE_URL|SECRET|TOKEN/);
  });

  it('protects runtime-gate evidence with Admin Workspace and Attendance View', () => {
    const route = source('app/api/admin/runtime/attendance-recovery/route.ts');
    expect(route).toContain("requireWorkspaceAccess('ADMIN_WORKSPACE')");
    expect(route).toContain("hasPermission(authContext, 'ATTENDANCE_VIEW')");
    expect(route).toContain("gate: 'ATTENDANCE_RECOVERY_ENABLED'");
    expect(route).toContain('attendanceRecoveryStatus(process.env.ATTENDANCE_RECOVERY_ENABLED)');
    expect(route).toContain("Cache-Control', 'no-store, max-age=0'");
    expect(route).not.toMatch(/request|searchParams|flagName|process\.env\[|Object\.keys\(process\.env\)/);
    expect(route).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
  });

  it('keeps the public version endpoint read-only and dynamic', () => {
    const route = source('app/api/system/version/route.ts');
    expect(route).toContain("export const dynamic = 'force-dynamic'");
    expect(route).toContain('export const revalidate = 0');
    expect(route).toContain('VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA');
    expect(route).not.toMatch(/createClient|\.from\(|\.insert|\.update|\.delete|fetch\(/);
  });

  it('keeps operator evidence instructions aligned with the response contracts', () => {
    const runbook = source('docs/production-runtime-gate-operator-runbook.md');
    const handoff = source('docs/current-operator-handoff.md');
    const matrix = source('docs/runtime-gate-activation-matrix.md');
    const roadmap = source('docs/ERP_IMPLEMENTATION_ROADMAP.md');
    expect(runbook).toContain('GET https://erp.luminalfactory.com/api/system/version');
    expect(runbook).toContain('GET https://erp.luminalfactory.com/api/admin/runtime/attendance-recovery');
    expect(runbook).toContain('https://erp.luminalfactory.com');
    expect(runbook).toContain('e2090766cd6d9193f43ed2006657859b9251647e');
    expect(runbook).toContain('bc763507-2dbb-4598-b89f-5f7f8a951429');
    expect(runbook).toContain('PRODUCTION_DEPLOYMENT_REQUIRED');
    expect(runbook).toContain('status=disabled');
    expect(runbook).toContain('Asia/Bangkok');
    expect(handoff).toContain('READY_FOR_TEST_FIXTURE_PROVISIONING_APPROVAL');
    expect(handoff).toContain('/api/system/version');
    expect(handoff).toContain('/api/admin/runtime/attendance-recovery');
    expect(handoff).toContain('e2090766cd6d9193f43ed2006657859b9251647e');
    expect(matrix).toContain('https://erp.luminalfactory.com');
    expect(matrix).toContain('status=disabled');
    expect(roadmap).toContain('READY_FOR_TEST_FIXTURE_PROVISIONING_APPROVAL');
    expect(roadmap).toContain('e2090766cd6d9193f43ed2006657859b9251647e');
  });
});

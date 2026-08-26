import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('global loading foundation', () => {
  it('provides a shared global loading overlay with accessibility and timing guards', () => {
    const loadingSource = source('component/GlobalLoading.tsx');
    const layoutSource = source('app/layout.tsx');

    expect(layoutSource).toMatch(/GlobalLoadingProvider/);
    expect(loadingSource).toMatch(/GlobalLoadingProvider/);
    expect(loadingSource).toMatch(/GlobalLoadingOverlay/);
    expect(loadingSource).toMatch(/aria-live="polite"/);
    expect(loadingSource).toMatch(/aria-busy="true"/);
    expect(loadingSource).toMatch(/aria-modal="true"/);
    expect(loadingSource).toMatch(/onKeyDown/);
    expect(loadingSource).toMatch(/event\.key === 'Tab'/);
    expect(loadingSource).toMatch(/setTimeout\(.*180/s);
    expect(loadingSource).toMatch(/Math\.max\(300 - elapsed, 0\)/);
    expect(loadingSource).not.toMatch(/localStorage|sessionStorage/);
  });

  it('supports Vietnamese contextual loading messages', () => {
    const loadingSource = source('component/GlobalLoading.tsx');

    expect(loadingSource).toMatch(/Đang đăng nhập\.\.\./);
    expect(loadingSource).toMatch(/Đang mở khu vực quản trị\.\.\./);
    expect(loadingSource).toMatch(/Đang mở khu vực nhân viên\.\.\./);
    expect(loadingSource).toMatch(/Đang đăng xuất\.\.\./);
    expect(loadingSource).toMatch(/Đang tải dữ liệu\.\.\./);
    expect(loadingSource).toMatch(/Đang lưu thay đổi\.\.\./);
    expect(loadingSource).toMatch(/Đang gửi lời mời\.\.\./);
  });

  it('shows and clears loading around login failures while keeping it through successful navigation', () => {
    const loginSource = source('app/admin/AdminLoginForm.tsx');

    expect(loginSource).toMatch(/if \(checking\) return/);
    expect(loginSource).toMatch(/showGlobalLoading\('Đang đăng nhập\.\.\.'\)/);
    expect(loginSource).toMatch(/hideGlobalLoading\(\)/);
    expect(loginSource).toMatch(/setGlobalLoadingMessage/);
    expect(loginSource).toMatch(/Đang mở khu vực quản trị\.\.\./);
    expect(loginSource).toMatch(/Đang mở khu vực nhân viên\.\.\./);
    expect(loginSource).toMatch(/disabled=\{checking\}/);
  });

  it('keeps logout as one signOut call with loading and failure recovery', () => {
    const logoutSource = source('app/admin/AdminLogoutButton.tsx');
    const logoutFlowSource = source('utils/auth/logout.ts');

    expect(logoutFlowSource).toMatch(/auth\.signOut\(\{ scope: 'local' \}\)/);
    expect(logoutSource).toMatch(/if \(loggingOut\) return/);
    expect(logoutSource).toMatch(/showGlobalLoading\('Đang đăng xuất\.\.\.'\)/);
    expect(logoutSource).toMatch(/hideGlobalLoading\(\)/);
    expect(logoutSource).toMatch(/navigateAfterLogout\('\/'\)/);
  });

  it('uses loading links for landing and workspace switching', () => {
    const landingSource = source('app/page.tsx');
    const adminShellSource = source('component/app-shell/AdminAppShell.tsx');
    const staffPortalSource = source('app/staff/portal/StaffPortalContent.tsx');

    expect(landingSource).toMatch(/LoadingLink/);
    expect(landingSource).toMatch(/Đang mở khu vực quản trị\.\.\./);
    expect(landingSource).toMatch(/Đang mở khu vực nhân viên\.\.\./);
    expect(adminShellSource).toMatch(/LoadingLink/);
    expect(staffPortalSource).toMatch(/LoadingLink/);
  });

  it('adds route and ledger loading states without showing fake zero values on load error', () => {
    const adminLoading = source('app/admin/loading.tsx');
    const staffLoading = source('app/staff/loading.tsx');
    const capitalSource = source('app/admin/capital/page.tsx');

    expect(adminLoading).toMatch(/PageLoadingState/);
    expect(staffLoading).toMatch(/PageLoadingState/);
    expect(capitalSource).toMatch(/LedgerLoadingSkeleton/);
    expect(capitalSource).toMatch(/Không tải được dữ liệu\./);
    expect(capitalSource).toMatch(/Không có giao dịch trong kỳ đã chọn\./);
    expect(capitalSource).toMatch(/loading \? \(/);
    expect(capitalSource).toMatch(/: loadError \? \(/);
  });

  it('centers the shared loader across nested route loading boundaries', () => {
    const sharedLoading = source('component/GlobalLoading.tsx');
    const accountsLoading = source('app/admin/accounts/loading.tsx');
    const employeeLoading = source('app/admin/employees/[employeeId]/loading.tsx');

    expect(sharedLoading).toMatch(/return <CenteredPageLoading message=\{message\}/);
    expect(accountsLoading).toMatch(/CenteredPageLoading/);
    expect(employeeLoading).toMatch(/CenteredPageLoading/);
  });


  it('uses the centered Luminal loader for root and project routes', () => {
    const rootLoadingSource = source('app/loading.tsx');
    const projectLoadingSource = source('app/admin/projects/[projectId]/loading.tsx');
    const projectDetailSource = source('app/admin/projects/[projectId]/page.tsx');
    const projectListSource = source('app/admin/projects/page.tsx');
    const loaderSource = source('component/LuminalLoader.tsx');
    const globalStyles = source('app/globals.css');

    expect(rootLoadingSource).toMatch(/CenteredPageLoading/);
    expect(projectLoadingSource).toMatch(/Đang tải chi tiết dự án/);
    expect(projectListSource).toMatch(/Đang tải danh sách dự án/);
    expect(projectDetailSource).toMatch(/Đang tải chi tiết dự án\.\.\./);
    expect(loaderSource).toMatch(/LuminalLoadingMark/);
    expect(loaderSource).toMatch(/role="status"/);
    expect(loaderSource).toMatch(/aria-busy="true"/);
    expect(globalStyles).toMatch(/luminal-loader__orbit/);
    expect(globalStyles).toMatch(/prefers-reduced-motion: reduce/);
  });

  it('uses button/action loading for employee account actions', () => {
    const employeeClientSource = source('app/admin/employees/AdminEmployeesClient.tsx');

    expect(employeeClientSource).toMatch(/activeActionKey/);
    expect(employeeClientSource).toMatch(/showGlobalLoading/);
    expect(employeeClientSource).toMatch(/Đang gửi lời mời\.\.\./);
    expect(employeeClientSource).toMatch(/Đang lưu thay đổi\.\.\./);
    expect(employeeClientSource).toMatch(/ButtonLoadingState/);
    expect(employeeClientSource).toMatch(/accountAction && !accountAction\.path/);
    expect(employeeClientSource).toMatch(/href=\{`\/admin\/employees\/\$\{employee\.employeeId\}`\}/);
    expect(employeeClientSource).toMatch(/disabled=\{accountAction\.disabled \|\| isPending \|\| Boolean\(activeActionKey\)\}/);
  });
});

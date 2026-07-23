import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(__dirname, "..");

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), "utf8");
}

describe("administration information architecture correction slice", () => {
  it("renames and regroups admin navigation by business domain without changing routes", () => {
    const shell = source("app/admin/AdminShell.tsx");

    expect(shell).toMatch(/groupTitle: "Tổng quan"/);
    expect(shell).toMatch(/groupTitle: "Dự án & sản xuất"/);
    expect(shell).toMatch(/groupTitle: "Nhân sự"/);
    expect(shell).toMatch(/groupTitle: "Tài chính"/);
    expect(shell).toMatch(/groupTitle: "Cấu hình hệ thống"/);
    expect(shell).toMatch(
      /name: "Cơ sở làm việc",\s*path: "\/admin\/facilities"/,
    );
    expect(shell).toMatch(
      /name: "Danh mục hệ thống",\s*path: "\/admin\/metadata"/,
    );
    expect(shell).toMatch(
      /name: "Tài khoản & quyền truy cập",\s*path: "\/admin\/accounts"/,
    );
    expect(shell).toMatch(/pathname\.startsWith\(`\$\{item\.path\}\/`\)/);
    expect(shell).not.toMatch(
      /Danh Sách Cơ Sở & GPS|Quản Lý Danh Mục DB|Gán Việc & Tiến Độ Phase|Sổ Cái Vốn & Chi Tiêu|Lịch Chấm Công Ca/,
    );
  });

  it("keeps account workspace actions mutually exclusive and adds visible pagination", () => {
    const client = source("app/admin/accounts/AdminAccountsClient.tsx");

    expect(client).toMatch(/Tài khoản & quyền truy cập/);
    expect(client).toMatch(/Truy cập cổng nhân viên/);
    expect(client).toMatch(/Truy cập trang quản trị/);
    expect(client).toMatch(/const \[pageSize, setPageSize\] = useState\(10\)/);
    expect(client).toMatch(/<option value=\{10\}>10<\/option>/);
    expect(client).toMatch(/<option value=\{20\}>20<\/option>/);
    expect(client).toMatch(/<option value=\{50\}>50<\/option>/);
    expect(client).toMatch(/pageAccounts\.map/);
    expect(client).toMatch(/createPortal/);
    expect(client).toMatch(
      /account\.hasStaffWorkspace[\s\S]*Thu hồi quyền truy cập cổng nhân viên[\s\S]*Cấp quyền truy cập cổng nhân viên/,
    );
    expect(client).toMatch(
      /account\.hasAdminWorkspace[\s\S]*Thu hồi quyền truy cập trang quản trị[\s\S]*Cấp quyền truy cập trang quản trị/,
    );
  });

  it("removes technical DB wording from the primary system catalog page", () => {
    const metadata = source("app/admin/metadata/page.tsx");

    expect(metadata).toMatch(/Danh mục hệ thống/);
    expect(metadata).toMatch(
      /Quản lý các danh mục nghiệp vụ dùng lại trong hệ thống/,
    );
    expect(metadata).toMatch(/Số dòng/);
    expect(metadata).not.toMatch(
      /Quản lý Danh Mục DB|Hệ Thống Danh Mục Metadata Trung Tâm|Database className|Cần tạo danh mục DB/,
    );
  });

  it("keeps workplace attendance on the shared facilities source", () => {
    const facilities = source("app/admin/facilities/page.tsx");
    const staffAttendanceRoute = source("app/api/staff/attendance/route.ts");

    expect(facilities).toMatch(/from\('facilities'\)/);
    expect(staffAttendanceRoute).toMatch(
      /const FACILITY_SELECT = 'id, facility_name, lat, lng, radius'/,
    );
    expect(staffAttendanceRoute).toMatch(/getDistance/);
    expect(staffAttendanceRoute).toMatch(/matchedBranch\.radius/);
    expect(staffAttendanceRoute).not.toMatch(
      /hardcodedFacilities|FACILITIES = \[/,
    );
  });
});

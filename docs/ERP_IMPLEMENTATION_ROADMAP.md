# Luminal Factory ERP Implementation Roadmap

## 1. Mục đích

Tài liệu này theo dõi toàn bộ lộ trình triển khai Luminal Factory ERP từ giai đoạn chuẩn hóa Codex, audit hệ thống, bảo mật dữ liệu, Supabase Auth, database migration, workflow dự án cho tới thiết kế lại giao diện SaaS ERP.

Tài liệu này là roadmap thực thi.

Các quy tắc chi tiết vẫn thuộc về:

- `AGENTS.md`
- `SETUP-CODEX-ERP.md`
- `.agents/skills/luminal-erp/SKILL.md`
- `.agents/skills/luminal-erp/references/*`
- Các specification trong `specs/*`

Không dùng roadmap này để thay thế business rule hoặc security rule chi tiết.

---

## 2. Quy tắc sử dụng roadmap

- Chỉ thực hiện một giai đoạn hoặc một batch tại một thời điểm.
- Không tự chuyển sang bước tiếp theo nếu chưa được người dùng xác nhận.
- Nếu gặp lỗi, thiếu quyền, thiếu dữ liệu, thiếu biến môi trường hoặc cần thao tác trên Supabase Dashboard, phải dừng và báo rõ.
- Không tự tạo dữ liệu giả để vượt lỗi.
- Không hard-code secret, token, UUID, mật khẩu hoặc key.
- Không tự chạy migration, RLS, backfill hoặc lệnh phá dữ liệu nếu chưa được duyệt.
- Không chạy `npm audit fix --force`.
- Không chạy `supabase db push`, `supabase migration up`, `supabase migration repair` hoặc `supabase db reset` nếu chưa được duyệt rõ.
- Không thay đổi payroll calculation hoặc attendance calculation nếu chưa có regression test và phê duyệt.
- Không tự thay đổi role, permission hoặc identity mapping.
- Không đưa secret vào biến `NEXT_PUBLIC_*`.
- Không ghi Auth UUID thật vào file được Git theo dõi.
- Toàn bộ nội dung người dùng nhìn thấy phải dùng tiếng Việt đơn giản.
- Tên biến, type, enum và database field có thể dùng tiếng Anh.
- Mỗi bước chỉ được đánh dấu hoàn thành khi validation tương ứng PASS.

---

## 3. Trạng thái giai đoạn

| Biểu tượng | Trạng thái | Ý nghĩa |
|---|---|---|
| ✅ | Hoàn thành | Đã triển khai và kiểm tra |
| 🔄 | Đang làm | Đang thực hiện |
| ⏳ | Chưa làm | Chưa bắt đầu |
| ⛔ | Bị chặn | Thiếu quyền, dữ liệu, quyết định hoặc điều kiện |
| ⚠️ | Cần kiểm tra | Đã làm một phần nhưng chưa đủ bằng chứng |
| 💤 | Tạm hoãn | Ngoài phạm vi hiện tại |

---

## 4. Quy tắc xử lý lỗi và blocking

Khi một bước không thể tiếp tục:

1. Đánh dấu giai đoạn là `⛔ Bị chặn`.
2. Không tự đổi hướng triển khai.
3. Không dùng workaround làm giảm bảo mật.
4. Không tạo secret giả hoặc dữ liệu giả.
5. Báo rõ:
   - Lỗi gì
   - Xảy ra ở bước nào
   - Nguyên nhân đã xác minh
   - Điều kiện nào chưa đạt
   - Người dùng cần cung cấp thông tin gì
   - Người dùng cần thao tác gì trong Supabase, GitHub, Codespaces hoặc hệ thống khác
   - Lệnh nào dự kiến chạy lại sau khi xử lý
6. Chờ người dùng xác nhận đã xử lý.
7. Chạy lại đúng bước bị lỗi.
8. Chỉ chuyển sang bước tiếp theo khi validation PASS.

---

## 5. Quy tắc cập nhật roadmap

Sau mỗi batch, Codex phải cập nhật:

- Trạng thái giai đoạn
- Ngày cập nhật
- Tóm tắt kết quả
- File đã thêm hoặc sửa
- Test đã chạy
- Kết quả lint
- Kết quả type check
- Kết quả build
- Database impact
- Security impact
- Blocking còn lại
- Bước tiếp theo

Không xóa lịch sử giai đoạn đã hoàn thành.

---

# 6. Roadmap tổng thể

| Giai đoạn | Trạng thái | Mô tả | Prompt cho Codex | Bước tiếp theo |
|---|---:|---|---|---|
| **0. Chuẩn hóa Guidance** | ✅ | Audit `AGENTS.md`, skill, references và `SETUP-CODEX-ERP.md`. Phân định authority order, loại bỏ rule trùng và no-op guidance. | `Đọc AGENTS.md và SETUP-CODEX-ERP.md. Thực hiện guidance audit. Chỉ phân tích, không sửa application code, không cài dependency và không chạy migration.` | Refactor các file guidance theo báo cáo audit. |
| **0.1. Refactor Guidance** | ✅ | Giữ `AGENTS.md` là authority order duy nhất. `SKILL.md` làm router. References sở hữu rule chi tiết. SETUP chỉ giữ phase plan và prompt launcher. | `Thực hiện kế hoạch chỉnh sửa guidance đã duyệt. Chỉ sửa các file guidance. Không sửa application code. Sau đó chạy consistency review.` | Kiểm tra conflict, duplication và broken references. |
| **0.2. Chuẩn hóa tiếng Việt** | ✅ | Chốt toàn bộ UI dùng tiếng Việt đơn giản. Enum trong code vẫn dùng tiếng Anh nhưng mapping sang label tiếng Việt. | `Cập nhật guidance: tiếng Việt là ngôn ngữ mặc định và duy nhất trên UI. Không hard-code label rải rác. ui-rules.md là nguồn từ vựng chính.` | Audit toàn bộ UI chưa Việt hóa. |
| **0.3. Security Guidance** | ✅ | Bổ sung nguyên tắc frontend không đáng tin cậy, không lộ secret, server authorization, Supabase RLS, private storage và security test matrix. | `Bổ sung Security và Data Protection vào guidance. Không sửa application code. Thêm yêu cầu auth, RLS, storage, env, API validation, source maps và security tests.` | Chạy full repository audit. |
| **1. Full Repository Audit** | ✅ | Audit kiến trúc, Supabase, Auth, Attendance, Payroll, UI, Workflow, RLS, source map, hard-coded status, permission và sensitive data. | `Thực hiện Full Repository Audit theo SETUP-CODEX-ERP.md. Chỉ audit. Không sửa code, không migration, không cài dependency.` | Tạo specification foundation. |
| **2. Specification Foundation** | ✅ | Tạo `spec.md` và `plan.md` cho Supabase, Auth, Attendance, Payroll source of truth. | `Tạo specification “Supabase, Auth, Attendance Payroll Source of Truth Foundation”. Chỉ tạo spec và plan. Chưa sửa code.` | Chốt identity và business rules. |
| **2.1. Chốt Identity** | ✅ | Dùng `employees.id` làm khóa nội bộ. `employees.auth_user_id` liên kết Supabase Auth. `employee_id` là mã nghiệp vụ. `full_name` chỉ hiển thị. | `Cập nhật spec: employees.id là khóa quan hệ chính; auth_user_id liên kết auth.users; full_name không dùng làm relationship authority.` | Chốt payroll và attendance source of truth. |
| **2.2. Chốt Payroll và Attendance** | ✅ | Payroll dựa trên attendance evidence, wage history, adjustments và payroll period. Không tự thay đổi công thức hiện tại. | `Cập nhật spec: khóa current payroll behavior bằng fixtures và regression tests. Mọi thay đổi kết quả lương phải chờ duyệt riêng.` | Tạo safe foundation task breakdown. |
| **3. Batch 1: Audit và Test Baseline** | ✅ | Kiểm kê Supabase, env, identity, attendance/payroll formula, source maps. Tạo fixtures và regression test scaffold. | `Bắt đầu Batch 1. Chỉ inventory, audit công thức và tạo regression-test scaffold. Không đổi nghiệp vụ, schema hoặc RLS.` | Review, commit checkpoint. |
| **4. Batch 2: Auth và Data Boundary Hardening** | ✅ | Bỏ admin passcode hard-code, token URL/localStorage, không tin `employeeId` từ frontend, giảm dữ liệu nhạy cảm tải về Client Component. | `Bắt đầu Batch 2. Xử lý security finding Critical. Không thay đổi payroll/attendance calculation hoặc database schema.` | Chuẩn hóa Supabase client boundary. |
| **5. Batch 3A: Supabase Client Boundary** | ✅ | Tách browser/server/middleware client. Ưu tiên publishable key. Anon key chỉ fallback tạm. Build đã PASS. | `Bắt đầu Batch 3A. Chuẩn hóa Supabase env contract và client ownership. Không schema, RLS, payroll hoặc UI changes.` | Thiết kế identity migration và RLS. |
| **6. Batch 3B: Identity và RLS Draft** | ✅ | Thiết kế `auth_user_id`, backfill, RLS matrix, storage policy và security test matrix. Chưa chạy migration. | `Bắt đầu Batch 3B. Tạo identity schema draft, backfill plan, RLS policy draft và storage policy draft. Không chạy SQL.` | Audit live schema và migration drift. |
| **7. Batch 3C1: Migration Drift Audit** | ✅ | Chọn live DB làm baseline. Xác định migration history lệch. Không dùng `migration up --linked`. Audit `system_settings`. | `Audit migration drift và live schema. Không migration repair, db push, DDL hoặc DML. Tạo reconciliation plan.` | Bootstrap Owner Auth account. |
| **8. Batch 3C2: Owner Auth Bootstrap** | ✅ | Tạo và xác minh Auth user Tùng Duy bằng email invite. Khớp đúng một Auth user với employee internal ID 3. | `Xác minh Owner Auth bootstrap theo normalized email. Không map bằng full_name. Chỉ tạo mapping proposal và SQL draft.` | Chuẩn bị migration `auth_user_id`. |
| **9. Batch 3C3: Isolated Auth Mapping Deployment** | ✅ | Hoàn thành migration cô lập `employees.auth_user_id`, Owner backfill, validation và migration history repair riêng cho version `20260712181332`. Không chạy migration cũ. | `Batch 3C3 đã hoàn thành. Không sửa schema/data/RLS thêm.` | Batch 3C4 Invite và Password Flow. |
| **10. Batch 3C3 Part 1: Preflight Read-only** | ✅ | Đã kiểm tra bảng, employee ID 3, Auth user, constraint/index name và điều kiện trước migration. Tất cả điều kiện preflight đã PASS. | `Part 1 đã PASS. Tiếp tục Part 2 theo isolated deployment runbook.` | Đã chuyển sang Part 2. |
| **11. Batch 3C3 Part 2: Schema Migration Cô lập** | ✅ | Đã chạy riêng migration thêm `employees.auth_user_id` bằng `supabase db query --linked --file`. Không chạy `migration up`, `db push` hoặc migration cũ. | `Part 2 đã chạy thành công. Chạy Part 3 schema validation.` | Đã chuyển sang Part 3. |
| **12. Batch 3C3 Part 3: Schema Validation** | ✅ | Schema validation đã PASS bằng query sửa dùng `pg_constraint` và `pg_attribute`. Lỗi cũ là false negative do validation query join `constraint_column_usage` bị mất dòng FK. | `Part 3 đã PASS. Chuẩn bị Part 4 Owner backfill nhưng chưa chạy cho đến khi người dùng duyệt.` | Chuẩn bị gate Part 4. |
| **13. Batch 3C3 Part 4: Owner Backfill** | ✅ | Owner backfill đã chạy trong Supabase SQL Editor. Part 5 validation xác nhận employee ID 3 được map đúng một Auth user, không đổi role/status/email. | `Part 4 đã hoàn thành. Part 5 mapping validation đã PASS.` | Đã chuyển sang Part 5. |
| **14. Batch 3C3 Part 5: Mapping Validation** | ✅ | Read-only validation đã PASS: employee ID 3 có đúng một `auth_user_id`, Auth user tồn tại, normalized email khớp, không duplicate/orphan, role `ADMIN`, status `ACTIVE`, không có mapping ngoài employee ID 3. | `Part 5 mapping validation đã PASS. Không sửa dữ liệu, schema, RLS, role hoặc migration history.` | Chờ duyệt Part 6. |
| **15. Batch 3C3 Part 6: Migration History** | ✅ | Đã đánh dấu riêng version `20260712181332` là applied bằng `migration repair`. Hai migration cũ vẫn chưa bị ghi nhận trên remote. Schema và Owner mapping không đổi sau repair. | `Part 6 đã PASS. Không chạy migration SQL, migration up, db push, db reset hoặc repair migration cũ.` | Batch 3C4 Invite và Password Flow. |
| **16. Batch 3C4: Invite và Password Flow** | ⚠️ | Password setup live PASS. Supabase signIn request PASS. Admin session/navigation đang bị chặn vì `/admin/dashboard` trả 200 nhưng vẫn render form đăng nhập. Không sửa schema hoặc RLS. | `Batch 3C4 chưa hoàn thành. Sửa session/navigation sau đăng nhập rồi deploy để test lại.` | Hoàn tất admin session/navigation live verification trước Batch 3D1. |
| **17. Batch 3C4A: Session UX, Logout và Account Entry** | ⚠️ | Publishable key là public env chuẩn; dashboard không được biến query error thành số 0; Admin logout phải signOut local; landing page chọn quản trị/nhân viên. Không sửa schema/RLS/role. | `Deploy và live verify logout, dashboard error state, account selector. Batch 3C4 vẫn bị chặn tới khi login/admin data PASS.` | RLS own-row cho employees nếu live audit xác nhận cần policy. |
| **17.1. Batch 3C4B: RLS Admin Data Access Slice 1** | ✅ | Hoàn thành có điều kiện. Đã rollout helper `public.is_app_admin()` và SELECT policy `"financial ledger admin select"` cho `public.financial_ledger`. Live verification PASS: admin login hoạt động, Dashboard đọc được ledger, RLS slice 1 hoạt động đúng. | `RLS slice 1 đã PASS có điều kiện. Dashboard financial_ledger access đã Hoàn thành.` | RLS slice 2 cho `office_expenses` và `shareholders`. |
| **17.2. Batch 3C4C: Ledger Reporting-period Fix** | ✅ | Hoàn thành. Trang Sổ Cái dùng `month_period` làm kỳ nghiệp vụ, không dùng `created_at`; live verification PASS với dữ liệu nhập dồn tháng 6/7 nhưng thuộc kỳ trước. | `Ledger reporting-period fix đã Hoàn thành. Query lỗi không giả thành danh sách rỗng.` | Tiếp tục các slice RLS còn lại. |
| **17.3. Batch 3C4D: RLS Admin Data Access Slice 2** | ✅ | Hoàn thành có điều kiện. Đã rollout SELECT policy admin cho `public.office_expenses` và `public.shareholders`, tái sử dụng `public.is_app_admin()`. Validation bắt buộc PASS; STAFF ACTIVE và ADMIN/OWNER INACTIVE denial DEFERRED vì chưa có mapped fixture. | `RLS slice 2 đã PASS có điều kiện. Dashboard data access đã Hoàn thành sau live verification.` | RLS Workflow slice cho `projects`, `phases` và `tasks`. |
| **17.4. Batch 3C4E: Dashboard Server DTO Slice** | ✅ | Hoàn thành. Admin Dashboard đã chuyển data access tài chính sang server-side DTO: server xác minh admin, dùng Supabase server session client và RLS, chỉ trả DTO tối thiểu cho chart/UI. Live verification PASS, gồm DevTools Network xác nhận không còn browser query trực tiếp tới bảng tài chính. | `Dashboard Server DTO slice PASS hoàn toàn. Dashboard data access đã Hoàn thành.` | RLS Workflow slice cho `projects`, `phases` và `tasks`. |
| **17.5. Batch 3C4F: Project Read RLS** | ✅ | Hoàn thành ngày 2026-07-16. Đã rollout đúng Project Read RLS artifact `supabase/migrations/20260716035555_project_rls_pre_run_review.sql`: tạo helper `is_project_member`, `has_project_role`, `can_view_project` và SELECT policy `projects project access select` cho `public.projects`. Không tạo INSERT/UPDATE/DELETE/ALL policy, không sửa grants, không sửa dữ liệu, không sửa `phases`/`tasks`/`staff_tasks` hoặc `project_members` rows. Validation database-state PASS; employee 1/2 và inactive denial DEFERRED do thiếu auth fixture. | `Project Read RLS đã Hoàn thành. Project Mutation Server Boundary đang làm.` | Project Mutation Server Boundary. |
| **17.5A. Project Mutation Server Boundary** | ✅ | Hoàn thành, chờ deploy. Create/update/archive project đã đi qua API server `app/api/admin/projects/...` và service server-only `services/server/projectMutations.ts`; browser không còn `projects.insert/update/delete/upsert`. Server kiểm tra `ADMIN_WORKSPACE`, `PROJECT_MANAGE`, project membership role, DTO whitelist, archive bằng status update và không mở browser mutation policy. | `Project Mutation Server Boundary đã Hoàn thành, chờ commit/push/deploy.` | Project Mutation Live Verification. |
| **17.5B. Project Mutation Live Verification** | ⏳ | Chờ. Cần deploy code server route mới rồi live verify create/update/archive với quyền thật, lỗi 401/403/404/409/422/500, và xác nhận secret chỉ server-side. | `Live verification chờ sau deploy.` | Duyệt và chạy live verification. |
| **17.5C. Phase RLS** | ⏳ | Chờ. Chưa tạo policy cho `public.phases`; chưa thay query phase/task trong lượt Project Mutation Server Boundary. | `Phase RLS chờ sau live verification hoặc duyệt riêng.` | Thiết kế Phase RLS riêng. |
| **17.6. Access & Permission Foundation Slice 1** | ✅ | Hoàn thành. Đã chạy đúng foundation SQL `20260714082140_access_permission_foundation.sql`: tạo `employee_workspace_access`, `permissions`, `employee_permissions`, helper read-only, RLS và policy SELECT tối thiểu. Không backfill, không thay `is_app_admin()`, không sửa RLS cũ, route, menu, `employees.role` hoặc `project_members`. Validation 16/16 PASS; row count bảng nghiệp vụ không đổi. | `Access & Permission Foundation Slice 1 đã Hoàn thành. Chưa backfill quyền.` | Current Account Access Backfill. |
| **17.7. Current Account Access Backfill** | ✅ | Hoàn thành. Đã chạy đúng Slice 2 backfill artifact `supabase/backfills/20260714094546_current_account_access_permissions.sql`: tạo 2 workspace access ACTIVE và 17 permission ALLOW ACTIVE cho đúng một tài khoản hiện tại đã map Auth. Không tạo Auth user, không gửi invite, không sửa `employees.role/status/auth_user_id`, `public.is_app_admin()`, finance RLS, routes, middleware, menu hoặc dữ liệu nghiệp vụ. Validation database-state 20/20 PASS; session-context helper checks SKIPPED vì SQL/admin context không có `auth.uid()`. | `Current Account Access Backfill đã Hoàn thành. Bootstrap rows = 19.` | Runtime Permission Bridge. |
| **17.8. Runtime Permission Bridge** | ✅ | Hoàn thành có điều kiện. Runtime server helper đã đọc `employee_workspace_access` và `employee_permissions`, áp dụng DENY thắng ALLOW, admin gate ưu tiên `ADMIN_WORKSPACE` và giữ legacy ADMIN/OWNER fallback. Staff gate dùng `STAFF_WORKSPACE`; `/staff` là Staff Home thật và `/staff/portal` redirect về `/staff`; Staff login riêng đã bị loại khỏi route tree và login chung resolve workspace mặc định. Navigation hiển thị chuyển khu vực khi user có cả hai workspace. Chưa thay `public.is_app_admin()`, finance RLS hoặc `project_members`. | `Staff unified authentication đã Hoàn thành có điều kiện. Cần commit/push/deploy để live nhận code.` | Employee List Read Bridge SQL rollout. |
| **17.9. Employee List Read Bridge** | ⚠️ | Employee List Read RLS = Hoàn thành. Đã rollout SELECT policy `employees admin employee view select` cho `ADMIN_WORKSPACE` + `EMPLOYEE_VIEW`, giữ own-profile SELECT policy cho Staff. Employee List Read Bridge = Chờ deploy application code: Admin employee page đã chuyển sang Server Component + server DTO `EmployeeListItem`; client không query `employees` trực tiếp. | `Live RLS đọc đủ 5 employee records cho target account; application bridge chờ commit/push/deploy.` | Employee Account Actions review/deploy. |
| **17.10. Employee Account Actions** | ⚠️ | Hoàn thành có điều kiện phần application code. Account actions chạy server-only qua Supabase Admin client, yêu cầu `ADMIN_WORKSPACE` + `ACCOUNT_MANAGE`; thêm/sửa/vô hiệu hóa yêu cầu `EMPLOYEE_MANAGE`; UI ẩn action theo capability và server kiểm tra lại. Chưa chạy live do phụ thuộc commit/push/deploy và secret env `SUPABASE_SECRET_KEY` hoặc `SUPABASE_SERVICE_ROLE_KEY`. | `Employee Account Actions đã sẵn sàng review. Không gửi invite/reset trong lúc triển khai.` | Account Permission Management Page. |
| **17.10A. Project Membership Foundation** | ✅ | Hoàn thành ngày 2026-07-15. Đã rollout đúng foundation artifact `supabase/migrations/20260714045636_project_members_foundation.sql`: tạo `public.project_members`, FK tới `projects`/`employees`, role `PROJECT_OWNER`/`PROJECT_MANAGER`/`CREATIVE_LEAD`/`CONTRIBUTOR`, status `ACTIVE`/`REVOKED`, partial unique ACTIVE membership, indexes, audit trigger và RLS tối thiểu cho `ADMIN_WORKSPACE` + `PROJECT_VIEW`/`PROJECT_MANAGE`. Không backfill, không sửa projects/phases/tasks/staff_tasks/employees/attendance/finance/Auth. Validation bắt buộc PASS; `project_members` row count = 0; row count nghiệp vụ và task legacy fingerprint không đổi. | `Project Membership Foundation đã Hoàn thành. Chưa tạo membership rows.` | Project Membership Backfill chờ duyệt riêng. |
| **17.10B. Project Membership Backfill** | ✅ | Hoàn thành ngày 2026-07-16. Đã chạy đúng artifact `supabase/backfills/20260715103000_project_members_initial_backfill.sql` một lần: tạo 6 ACTIVE membership đã duyệt cho project 1 và 2, không tạo CONTRIBUTOR, không sửa task assignment hoặc dữ liệu `projects`/`phases`/`tasks`/`staff_tasks`/`employees`/`attendance`/`financial_ledger`. Validation 20/20 PASS; rollback target đúng 6 bootstrap rows. | `Project Membership Backfill đã Hoàn thành. ACTIVE memberships = 6.` | Project RLS đang làm. |
| **17.11. Account Permission Management Page** | ⏳ | Trang quản lý workspace access và permission rows cho từng tài khoản. Cần thiết kế riêng để cấp/thu hồi `EMPLOYEE_VIEW`, `EMPLOYEE_MANAGE`, `ACCOUNT_MANAGE` và các permission khác bằng UI có audit rõ ràng. | `Bước tiếp theo sau khi Employee List/Account Actions được deploy và verify.` | Thiết kế permission management UI/API. |
| **18. Batch 3D1: system_settings Runtime Removal** | ✅ | Đã loại bỏ runtime dependency khỏi `system_settings`: tắt UI Cấu hình trung tâm, bỏ menu, chuyển SMTP sang server env, chuyển cấu hình VietQR qua API admin đọc env. Bảng và dữ liệu vẫn giữ nguyên. | `Không đọc/ghi system_settings từ runtime. Không drop bảng/dữ liệu. Không sửa broad policy trong slice này.` | Duyệt riêng broad-policy remediation. |
| **19. Batch 3D2: system_settings Broad-policy Remediation** | 🔄 | Đã tạo SQL draft riêng để drop `Allow anon all` và `Allow authenticated all`, kèm rollback và validation/security tests. Chưa chạy SQL. | `Review draft policy remediation. Chỉ chạy sau duyệt riêng. Không gộp với runtime removal.` | Duyệt và rollout policy slice. |
| **20. Batch 3E1: Own-row RLS** | ⏳ | Bật RLS an toàn cho `employees`, `attendance`, `attendance_logs`. Staff chỉ xem dữ liệu của mình. | `Triển khai own-row RLS dựa trên auth.uid() → employees.auth_user_id. Không mở payroll/finance toàn hệ thống.` | Security matrix cho authenticated và wrong-user access. |
| **21. Batch 3E2: Payroll và Finance Authorization** | ⏳ | Staff chỉ xem payslip của mình. Owner/Admin/Payroll xem theo permission. Project Manager không mặc định xem lương. | `Thiết kế và triển khai server authorization/RLS cho payroll và finance. Không thay đổi payroll calculation.` | Audit log và regression security tests. |
| **22. Batch 3F: Storage Security** | ⏳ | Private buckets, signed URL ngắn hạn hoặc server-mediated access cho staff docs, payroll, attendance, STL, artwork và formulas. | `Audit storage usage và triển khai private access cho dữ liệu nhạy cảm. Không migrate tất cả bucket trong một lượt.` | Chuyển từng nhóm file. |
| **23. Batch 3G: QR Check-in Security** | ⏳ | Thay long-lived token bằng short-lived challenge, expiry, nonce, replay protection và server validation. | `Thiết kế và triển khai QR check-in an toàn. Không dùng token dài hạn trong URL/localStorage và không tin employeeId từ client.` | Test thiết bị dùng chung và nhân viên chưa đăng nhập. |
| **24. Batch 4: Canonical Workflow Domain** | ⏳ | Chuẩn hóa Project, Colorway, Stage, Task, transitions, approval, revision, blocked, reopen và audit history. | `Bắt đầu Workflow Domain phase. Chuẩn hóa canonical statuses, transition validator, approval flow và dependency model. Chưa redesign UI.` | Tạo schema draft và migration plan workflow. |
| **25. Batch 5: Workflow Backend và Services** | ⏳ | Tách workflow, finance và calculations khỏi UI. Tạo services, permission, activity log và progress calculator. | `Triển khai WorkflowService, transition validator, approval, dependency, audit log và project progress. Không sửa UI ngoài integration cần thiết.` | Test business rules. |
| **26. Batch 6A: SaaS App Shell** | ⏳ | Tạo sidebar, header, breadcrumb, command menu, notifications và permission-aware navigation theo Shadcn/Efferd. | `Bắt đầu SaaS App Shell. Dùng Efferd Dashboard 2 làm visual reference, không copy demo data. Toàn bộ UI tiếng Việt.` | Chuyển Dashboard. |
| **27. Batch 6B: Dashboard ERP** | ⏳ | KPI thật về dự án, task, approval, production, QC, tồn kho và đơn hàng. Không dùng số liệu demo. | `Redesign Dashboard theo Efferd Dashboard 2, chỉ dùng dữ liệu thật. Thêm loading, empty, error, responsive và accessibility.` | Project List và Project Detail. |
| **28. Batch 6C: Project Workflow UI** | ⏳ | Project List, Detail, Workflow View, Kanban, Timeline và My Work. | `Redesign Project UI theo shared patterns. Drag/drop phải validate transition. Trạng thái hiển thị tiếng Việt từ shared vocabulary.` | Operations UI. |
| **29. Batch 7: Operations Modules** | ⏳ | Production, Print Test, Mold, Casting, QC, Inventory và Assets dùng chung app shell và design system. | `Chuyển các module Operations sang app shell và design system mới. Không tạo design system song song.` | Commerce, Staff và Finance UI. |
| **30. Batch 8: Commerce, Team và Finance UI** | ⏳ | Products, Colorways, Raffles, Orders, Staff, Attendance, Payroll, Expenses và Reports. | `Chuyển Commerce, Team và Finance sang shared page patterns. Giữ nguyên calculation đã khóa bằng regression tests.` | Performance và release readiness. |
| **31. Batch 9: Release Hardening** | ⏳ | Accessibility, responsive, performance, rerender, dependency vulnerabilities, demo cleanup và production build. | `Thực hiện release readiness audit: lint, typecheck, tests, build, security matrix, accessibility, responsive và performance.` | Release production theo rollout plan. |

---

# 7. Giai đoạn hiện tại

## Batch 3C4: Invite và Password Flow

**Trạng thái:** ⚠️ Cần kiểm tra thực tế

**Cập nhật:** 2026-07-13

### Kết quả hiện tại

- Part 1 preflight: PASS
- Part 2 schema migration: PASS
- Cột `employees.auth_user_id` tồn tại: PASS
- Kiểu dữ liệu `uuid`: PASS
- Nullable: PASS
- Unique partial index: PASS
- Foreign key tới `auth.users(id)` với `ON DELETE SET NULL`: PASS
- Owner backfill đã chạy trong Supabase SQL Editor: PASS
- Lần chạy trước đó: NOT RUN do Supabase CLI thiếu access token.
- Part 5 mapping validation: PASS
- Employee ID 3 có đúng một `auth_user_id`: PASS
- Linked Auth user tồn tại: PASS
- Normalized email khớp: PASS
- Không có duplicate `auth_user_id`: PASS
- Không có orphan mapping: PASS
- Employee role vẫn `ADMIN`: PASS
- Employee status vẫn `ACTIVE`: PASS
- Không có mapping ngoài employee ID 3: PASS
- Part 6 migration history: PASS
- Version được cập nhật: `20260712181332`
- Command đã chạy: `npx supabase migration repair --linked --status applied 20260712181332`
- `migration list` trước repair: `20260712181332` có local version, remote trống.
- `migration list` sau repair: `20260712181332` có remote version `20260712181332`.
- Hai migration cũ `20260704153000` và `20260709110000`: remote vẫn trống sau repair.
- Schema live sau repair: không đổi, vẫn tương đương migration `20260712181332`.
- Owner mapping sau repair: không đổi.
- Batch 3C4 invite/password flow: Cần kiểm tra thực tế
- Public route `/auth/callback`: PASS
- Public route `/auth/update-password`: PASS
- Public route `/auth/forgot-password`: PASS
- Production route `/auth/callback` không còn 404: PASS
- Link email cũ trả `otp_expired`: EXPECTED do link đã hết hạn
- Recovery email delivery từ ERP: PASS
- Password setup bằng link thật: PASS
- Đăng nhập email/mật khẩu: Bị chặn
- Supabase signIn request: PASS
- Admin session/navigation: Bị chặn do `/admin/dashboard` trả 200 nhưng vẫn render form đăng nhập
- Quên mật khẩu dùng thông báo trung tính: PASS
- Admin gate dùng `employees.auth_user_id`: PASS
- Không để `code`, access token hoặc refresh token trên URL sau callback: PASS
- Không cho redirect ra domain ngoài: PASS
- Live verification sau cấu hình Supabase URL Configuration: Cần kiểm tra
- Live read-only mapping ngày 2026-07-13: PASS
- Employee ID 3 có đúng một linked Auth user: PASS
- Linked Auth user không orphan: PASS
- Employee ID 3 vẫn active ADMIN: PASS
- Invite/recovery email redirect URL thực nhận trong inbox: CHƯA XÁC MINH
- `/auth/callback` xử lý callback từ link thật thành công: PASS
- `/auth/update-password` đặt mật khẩu mới bằng session từ link thật: PASS
- Password setup: PASS
- Supabase signIn request: PASS
- Admin session/navigation: BỊ CHẶN
- Live verification 2026-07-13: production bundle đang phục vụ không chứa `POST /api/admin/auth` hoặc full document navigation; cần deploy lại bundle mới rồi test lại.
- Live verification tiếp theo: `POST /api/admin/auth` đã chạy nhưng trả `500 admin_verification_failed`; theo code cũ failure nằm ở employee lookup `employees.auth_user_id` trả database/query error. Cần deploy bản phân loại lỗi/diagnostic an toàn để xác định Supabase/PostgREST error code.
- Live verification kế tiếp xác nhận Supabase/Postgres `42703 undefined_column`; source đang select `employees.employee_id` trong khi live schema audit trước ghi cột này absent. Đã sửa admin auth lookup về select tối thiểu `id, auth_user_id, role, status, is_active`.
- Batch 3C4A audit: runtime source không còn bắt buộc `NEXT_PUBLIC_SUPABASE_ANON_KEY`; public env chuẩn là `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Batch 3C4A implementation: Admin logout dùng Supabase `signOut({ scope: 'local' })`; landing page chuyển thành lựa chọn quản trị/nhân viên; dashboard hiển thị lỗi query thay vì số 0 giả.
- Staff authentication/role model: chỉ audit/proposal; chưa tạo user, chưa sửa role/schema/RLS.
- Batch 3C4B RLS slice 1: Hoàn thành có điều kiện. Đã chạy đúng migration `20260713111027_rls_admin_financial_ledger_select.sql`; helper `public.is_app_admin()` và SELECT policy cho `public.financial_ledger` tồn tại; ADMIN ACTIVE đọc được 64 ledger rows; anonymous và unmapped authenticated user đọc 0 rows; `financial_ledger` row count vẫn 64; system_settings/schema/policy ngoài phạm vi không đổi. Live verification xác nhận Dashboard `financial_ledger` access Hoàn thành. STAFF ACTIVE và ADMIN/OWNER INACTIVE denial DEFERRED vì chưa có mapped fixture.
- Batch 3C4C Ledger reporting-period fix: Hoàn thành. Live verification xác nhận Sổ Cái hiển thị đúng theo kỳ nghiệp vụ `month_period`, không dùng `created_at` sai mục đích.
- Batch 3C4D RLS slice 2: Hoàn thành có điều kiện. Đã chạy isolated rollout đúng migration `20260714032416_rls_admin_office_expenses_shareholders_select.sql`; SELECT policy cho `public.office_expenses` và `public.shareholders` tồn tại; ADMIN ACTIVE đọc được 2 rows mỗi bảng; anonymous và unmapped authenticated user đọc 0 rows; row count vẫn là 2/2; không tạo policy INSERT/UPDATE/DELETE và không sửa schema ngoài phạm vi. STAFF ACTIVE và ADMIN/OWNER INACTIVE denial DEFERRED vì chưa có mapped fixture. Dashboard data access đã Hoàn thành sau live verification.
- Batch 3C4E Dashboard Server DTO slice: Hoàn thành. Dashboard không còn query `financial_ledger` từ Client Component; server gọi `requireAdminEmployee()`, dùng Supabase server session client và RLS, trả DTO gồm `summary`, `monthlyCashFlow`, `cashFlowComposition`, `reportingYear`, `generatedAt`. Live verification PASS: Tổng quan tài chính, biểu đồ dòng tiền theo kỳ nghiệp vụ, Sổ Cái, refresh, logout/login, không còn dữ liệu rỗng giả và DevTools Network không còn browser query trực tiếp tới bảng tài chính. Dashboard data access đã Hoàn thành.
- Batch 3C4F Project Read RLS: Hoàn thành ngày 2026-07-16. Đã chạy đúng file `supabase/migrations/20260716035555_project_rls_pre_run_review.sql`; rollback sẵn tại `supabase/rollbacks/20260716035555_project_rls_pre_run_review_rollback.sql`; validation dùng `supabase/validation/20260716035555_project_rls_pre_run_review_validation.sql` và live checks bổ sung. Kết quả: anonymous đọc 0; employee 3/4/6 đọc project 1 và 2; ADMIN_WORKSPACE + PROJECT_VIEW đọc đủ 2; membership không cần PROJECT_VIEW vẫn đọc đúng project; không có INSERT/UPDATE/DELETE/ALL policy; row count và fingerprint ngoài scope không đổi. Employee 1/2 và inactive denial DEFERRED do thiếu auth fixture.
- Project Mutation Server Boundary: Hoàn thành, chờ deploy. Browser workflow repository chỉ còn `projects.select` qua Read RLS; create/update/archive gọi `POST /api/admin/projects`, `PATCH /api/admin/projects/:projectId`, `POST /api/admin/projects/:projectId/archive`. Server-only service kiểm tra `ADMIN_WORKSPACE`, `PROJECT_MANAGE`, `PROJECT_OWNER`/`PROJECT_MANAGER` membership, reject unknown fields, không tin actor/role/permission từ client, dùng Supabase admin client sau authorization và không hard delete. Project Mutation Live Verification chờ; Phase RLS chờ.
- Access & Permission Foundation Slice 1: Hoàn thành ngày 2026-07-14. Đã chạy đúng file `supabase/migrations/20260714082140_access_permission_foundation.sql` bằng `npx supabase db query --linked --file`. Object mới: `public.employee_workspace_access`, `public.permissions`, `public.employee_permissions`, trigger helper `public.set_access_permissions_updated_at()`, authorization helpers `public.current_employee_id()`, `public.has_workspace_access(text)`, `public.has_permission(text)`, `public.can_access_admin()`, `public.can_access_staff()`, RLS bật và chỉ có policy SELECT tối thiểu. Validation SQL `supabase/validation/20260714082140_access_permission_foundation_validation.sql` PASS 16/16. Row count trước/sau không đổi: `employees` 5, `financial_ledger` 64, `office_expenses` 2, `shareholders` 2. Chưa có row trong `employee_workspace_access` hoặc `employee_permissions`; chưa chạy backfill.
- Current Account Access Backfill: Hoàn thành ngày 2026-07-14. Đã chạy đúng file `supabase/backfills/20260714094546_current_account_access_permissions.sql`; rollback sẵn tại `supabase/rollbacks/20260714094546_current_account_access_permissions_rollback.sql`; validation dùng `supabase/validation/20260714094546_current_account_access_permissions_validation.sql`. Kết quả: target workspace rows từ 0 lên 2, target permission rows từ 0 lên 17, bootstrap rows 19; row count nghiệp vụ không đổi (`employees` 5, `financial_ledger` 64, `office_expenses` 2, `shareholders` 2); role/status/auth mapping fingerprint không đổi. Không tạo Auth user, không gửi invite, không sửa `project_members` (remote hiện không có bảng này), chưa chuyển runtime bridge.
- Project Membership Foundation: Hoàn thành ngày 2026-07-15. Đã chạy đúng file `supabase/migrations/20260714045636_project_members_foundation.sql`; rollback sẵn tại `supabase/rollbacks/20260714045636_project_members_foundation_rollback.sql`; validation dùng `supabase/validation/20260714045636_project_members_foundation_validation.sql` và các live checks bổ sung. Kết quả: `public.project_members` tồn tại với 0 rows, role/status/check/FK/index/RLS/policy/grant/trigger PASS; row count nghiệp vụ không đổi (`projects` 2, `phases` 0, `tasks` 2, `staff_tasks` 0, `employees` 5, `attendance` 31, `financial_ledger` 64); task legacy fingerprint không đổi. Không chạy backfill membership.
- Project Membership Backfill: Hoàn thành ngày 2026-07-16. Đã chạy đúng file `supabase/backfills/20260715103000_project_members_initial_backfill.sql` một lần; rollback sẵn tại `supabase/rollbacks/20260715103000_project_members_initial_backfill_rollback.sql`; validation dùng `supabase/validation/20260715103000_project_members_initial_backfill_validation.sql` và live checks bổ sung. Kết quả: `PROJECT_OWNER` 2, `PROJECT_MANAGER` 2, `CREATIVE_LEAD` 2, tổng ACTIVE membership 6; mỗi project có đúng 3 membership đã duyệt; không duplicate ACTIVE; không membership ngoài project 1/2 hoặc employee 3/4/6; idempotency check PASS bằng candidate insert count 0; row count và fingerprint các bảng ngoài scope không đổi; rollback target đúng 6 bootstrap rows.
- Runtime Permission Bridge: Hoàn thành có điều kiện ngày 2026-07-15. App runtime đã có server helper `hasWorkspaceAccess`, `requireWorkspaceAccess`, `hasPermission`, `requirePermission`, `canAccessAdmin`, `canAccessStaff`; admin gate dùng `ADMIN_WORKSPACE` với legacy ADMIN/OWNER fallback; staff gate dùng `STAFF_WORKSPACE`; `/staff` là Staff Home và `/staff/portal` redirect server-side về `/staff`; Staff login riêng bị loại khỏi route tree; login chung resolve workspace mặc định. Cần commit/push/deploy để live nhận code mới.
- Employee List Read RLS: Hoàn thành ngày 2026-07-15. Đã chạy `supabase/migrations/20260715030000_rls_employee_admin_view_select.sql`: tạo đúng policy SELECT `employees admin employee view select` cho `has_workspace_access('ADMIN_WORKSPACE')` và `has_permission('EMPLOYEE_VIEW')`; giữ own-profile SELECT policy cho Staff; không tạo write/ALL/anon policy và không sửa dữ liệu employees. Employee List Read Bridge: Chờ deploy application code. Trang `app/admin/employees/page.tsx` là Server Component, đọc qua server DTO và session Supabase client; Client Component chỉ render/filter/action fetch.
- Employee Account Actions: Hoàn thành có điều kiện application code. Route invite/resend/reset/revoke yêu cầu `ACCOUNT_MANAGE`; route create/update/deactivate yêu cầu `EMPLOYEE_MANAGE`; account Auth Admin client server-only dùng secret env, không dùng `NEXT_PUBLIC_*`. Cần review, commit/push/deploy và verify live.
- Account Permission Management Page: Bước tiếp theo để quản lý workspace access và permission rows từ UI thay vì backfill/manual SQL.
- Batch 3D1 system_settings runtime removal: Đã tắt route UI Cấu hình trung tâm, bỏ menu, không còn browser query/mutation `system_settings`; SMTP đọc từ server env `SMTP_*`; VietQR bank config đọc qua `/api/admin/finance/config` từ env `COMPANY_BANK_CODE`/`COMPANY_BANK_ACCOUNT`; bảng dữ liệu vẫn giữ nguyên.
- Batch 3D2 broad-policy remediation: Chỉ tạo draft SQL/rollback/validation để drop broad policies `Allow anon all` và `Allow authenticated all`; chưa chạy SQL, chờ duyệt riêng.
- User không có quyền bị chặn khỏi khu vực quản trị bằng tài khoản thật: CHƯA XÁC MINH

### Kết luận Part 5

Part 5 mapping validation đã chạy read-only qua Supabase CLI linked query và
PASS. Không chạy thêm backfill, không sửa dữ liệu, không sửa schema, không sửa
RLS, không sửa role và không sửa migration history.

Evidence rút gọn:

- `owner_exact_non_null_auth_user_id_count = 1`
- `owner_non_null_mapping_count = 1`
- `matching_auth_user_count = 1`
- `matching_normalized_email_count = 1`
- `duplicate_auth_user_id_links = []`
- `orphan_auth_user_id_links = []`
- `other_non_null_auth_user_id_count = 0`
- `total_non_null_auth_user_id_count = 1`

### Ghi chú Part 3

Part 3 đã PASS sau khi sửa validation query dùng `pg_constraint` và
`pg_attribute`.

Lỗi trước đó là false negative: FK thật sự tồn tại, nhưng validation query cũ
join qua `information_schema.constraint_column_usage`, view này không trả dòng
cho constraint `employees_auth_user_id_fkey` trong môi trường hiện tại.

### Trạng thái Batch 3C3

- Part 1: ✅ Hoàn thành
- Part 2: ✅ Hoàn thành
- Part 3: ✅ Hoàn thành
- Part 4: ✅ Hoàn thành
- Part 5: ✅ Hoàn thành
- Part 6: ✅ Hoàn thành

### Kết luận Batch 3C3

Batch 3C3 đã hoàn thành. Migration schema đã được áp dụng cô lập, Owner mapping
đã được backfill và validation đã PASS, migration history đã được repair riêng
cho version `20260712181332`.

### Database impact

- Đã thêm cột nullable `public.employees.auth_user_id`.
- Đã tạo unique partial index `employees_auth_user_id_unique_not_null`.
- Đã xác minh đúng một mapping `auth_user_id` cho employee ID 3.
- Đã xác minh không có mapping ngoài employee ID 3.
- Đã ghi nhận remote migration history cho riêng version `20260712181332`.
- Chưa sửa RLS.
- Không chạy lại SQL migration.
- Không chạy `migration up --linked`, `db push` hoặc `db reset`.

### Security impact

- Không ghi Owner Auth UUID thật vào tracked file.
- Không hiển thị email đầy đủ hoặc Auth UUID đầy đủ trong báo cáo.
- Chưa mở thêm policy RLS.
- Không thay đổi role, status hoặc email nhân viên.
- Không thay đổi Owner mapping sau Part 5.
- Không log token, session, cookie hoặc mật khẩu trong auth routes mới.
- Không lưu token thủ công vào `localStorage` hoặc `sessionStorage`.
- Không thêm service role vào browser.
- Không sửa schema, RLS, role hoặc `employees.auth_user_id`.

### Blocking còn lại

Batch 3C4 chưa thể chuyển Hoàn thành vì admin session/navigation đang bị chặn.
Password setup đã PASS và Supabase signIn request đã PASS, nhưng
`/admin/dashboard` trả 200 vẫn render form đăng nhập. Không đổi schema/RLS/SMTP
và không tự chuyển sang Batch 3D1.

Checklist live verification còn lại:

1. Deploy bản sửa session/navigation sau đăng nhập quản trị.
2. Mở trang đăng nhập quản trị.
3. Nhập email/mật khẩu thật.
4. Xác nhận Supabase signIn request vẫn PASS.
5. Xác nhận ADMIN hợp lệ vào được dashboard shell, không render form đăng nhập.
6. Xác nhận lỗi được hiển thị rõ nếu sai mật khẩu, chưa map employee hoặc không có role ADMIN.
7. Xác nhận không có redirect loop.

### Bước tiếp theo

Tạm dừng và chờ người vận hành deploy bản sửa session/navigation rồi test lại.
Batch 3D1 vẫn chưa bắt đầu.

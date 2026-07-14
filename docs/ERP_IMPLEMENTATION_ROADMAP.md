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
| **17.1. Batch 3C4B: RLS Admin Data Access Slice 1** | ✅ | Hoàn thành có điều kiện. Đã rollout helper `public.is_app_admin()` và SELECT policy `"financial ledger admin select"` cho `public.financial_ledger`. Validation bắt buộc PASS; STAFF ACTIVE và ADMIN/OWNER INACTIVE denial DEFERRED vì chưa có mapped fixture và không tạo/sửa test data. | `RLS slice 1 đã PASS có điều kiện. Không sửa dữ liệu/system_settings, không tạo policy bảng khác, không tạo INSERT/UPDATE/DELETE policy.` | Dashboard data access vẫn Đang làm vì các bảng khác chưa có policy. |
| **18. Batch 3D1: system_settings Refactor** | ⏳ | Chưa bắt đầu. Chỉ chuyển thành Đang làm sau khi Batch 3C4 hoàn tất. | `Không chuyển sang Batch 3D1 khi Batch 3C4 còn bị chặn ở admin session/navigation.` | Khóa broad policy. |
| **19. Batch 3D2: system_settings RLS** | ⏳ | Xóa policy `anon/authenticated ALL`. Dùng deny-by-default và policy theo phạm vi. | `Triển khai RLS cho system_settings theo policy matrix đã duyệt. Có rollback SQL và security tests. Rollout từng policy nhỏ.` | Kiểm tra config và SMTP. |
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
- Batch 3C4B RLS slice 1: Hoàn thành có điều kiện. Đã chạy đúng migration `20260713111027_rls_admin_financial_ledger_select.sql`; helper `public.is_app_admin()` và SELECT policy cho `public.financial_ledger` tồn tại; ADMIN ACTIVE đọc được 64 ledger rows; anonymous và unmapped authenticated user đọc 0 rows; `financial_ledger` row count vẫn 64; system_settings/schema/policy ngoài phạm vi không đổi. STAFF ACTIVE và ADMIN/OWNER INACTIVE denial DEFERRED vì chưa có mapped fixture.
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

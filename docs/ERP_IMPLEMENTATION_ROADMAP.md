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
- Mặc định chỉ thực hiện một giai đoạn hoặc một batch tại một thời điểm. Khi người dùng bật `AUTO_RUN_ROADMAP`, Codex được tự chuyển sang bước kế tiếp sau khi Exit Criteria của bước hiện tại PASS; không cần xin xác nhận lại giữa các bước an toàn.
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

| Biểu tượng | Trạng thái   | Ý nghĩa                                         |
| ---------- | ------------ | ----------------------------------------------- |
| ✅         | Hoàn thành   | Đã triển khai và kiểm tra                       |
| 🔄         | Đang làm     | Đang thực hiện                                  |
| ⏳         | Chưa làm     | Chưa bắt đầu                                    |
| ⛔         | Bị chặn      | Thiếu quyền, dữ liệu, quyết định hoặc điều kiện |
| ⚠️         | Cần kiểm tra | Đã làm một phần nhưng chưa đủ bằng chứng        |
| 💤         | Tạm hoãn     | Ngoài phạm vi hiện tại                          |

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

# 5.1. Chế độ chạy roadmap tự động

Roadmap hỗ trợ hai chế độ:

## MANUAL_MODE

- Codex thực hiện đúng batch được giao.
- Sau khi hoàn thành, Codex cập nhật roadmap và chờ người dùng duyệt bước tiếp theo.
- Dùng cho migration, backfill, production data mutation, thay đổi RLS hoặc các thao tác cần phê duyệt riêng.

## AUTO_RUN_ROADMAP

Khi người dùng yêu cầu chạy toàn bộ roadmap hoặc một workstream, Codex được tự động thực hiện tuần tự từng batch mà không cần hỏi lại sau mỗi batch, với các điều kiện sau:

1. Chỉ chạy một batch tại một thời điểm.
2. Phải đọc `AGENTS.md`, `.agents/skills/luminal-erp/SKILL.md` và reference nhỏ nhất phù hợp trước mỗi batch.
3. Phải kiểm tra roadmap, spec, audit và handoff liên quan trước khi sửa code.
4. Phải hoàn thành Acceptance Criteria và Exit Criteria của batch hiện tại trước khi chuyển tiếp.
5. Sau mỗi batch phải cập nhật roadmap, tạo checkpoint commit riêng và chạy validation phù hợp.
6. Không gom nhiều batch vào một commit.
7. Không tự mở rộng scope sang module khác chỉ vì phát hiện cơ hội refactor.
8. Nếu gặp blocker thật, phải dừng toàn bộ chuỗi và báo `BLOCKED`.
9. Nếu một bước cần live SQL, migration, backfill, Auth mutation, permission mutation hoặc production data mutation chưa được duyệt rõ, phải dừng tại gate đó và báo `LIVE_APPROVAL_REQUIRED`.
10. Không dùng dữ liệu giả, hard-code option hoặc service-role bypass để vượt blocker.

### Auto-run validation gate

Một batch application-code chỉ được chuyển tiếp khi:

- `npm test` PASS
- `npm run lint` PASS hoặc chỉ còn warning có sẵn không thuộc diff
- `npx tsc --noEmit` PASS
- `npm run build` PASS
- Không còn P0/P1 finding
- Không có secret trong diff/log
- Không có unrelated change
- Không có production mutation ngoài phê duyệt
- Git diff đã được review
- Roadmap đã được cập nhật

### Git delivery trong AUTO_RUN_ROADMAP

- Codex được commit riêng từng batch.
- Codex chỉ được push/merge theo `Git delivery policy` trong `AGENTS.md`.
- Nếu checkout không có `origin`, branch protection chặn, authentication thất bại hoặc merge conflict, phải dừng ở trạng thái `BLOCKED_GIT_DELIVERY`.
- Không force-push, không reset để che conflict và không bỏ validation.

---

# 5.2. Acceptance Criteria, Exit Criteria và Handoff

Mỗi batch đang hoạt động phải có ba nhóm tiêu chí:

## Acceptance Criteria

Mô tả hành vi cụ thể cần tồn tại để batch được coi là đúng về mặt chức năng, dữ liệu, quyền và UX.

Checklist tối thiểu:

- Luồng chính hoạt động đúng.
- Error state và permission state rõ ràng.
- Không làm thay đổi business logic ngoài scope.
- Có regression coverage cho luồng quan trọng.
- Không tạo request thừa hoặc N+1 rõ ràng.
- Không lộ raw database error hoặc secret.
- UI người dùng nhìn thấy dùng tiếng Việt đơn giản.

## Exit Criteria

Batch chỉ được chuyển sang bước tiếp theo khi:

- Acceptance Criteria PASS.
- Test/lint/typecheck/build PASS theo validation matrix.
- Không còn P0/P1 finding.
- Database impact và security impact đã được ghi rõ.
- Manual QA checklist đã được tạo hoặc thực hiện.
- Roadmap đã cập nhật trạng thái, bằng chứng và bước tiếp theo.
- Không còn blocker chưa được phân loại.

## Handoff Notes

Phải ghi rõ:

- Những contract mà batch sau được phép dựa vào.
- Những legacy field/schema vẫn còn tồn tại.
- Những phần chưa được triển khai.
- Migration/backfill/live verification còn thiếu.
- Regression boundary cần giữ nguyên.
- File/spec/roadmap nào là source of truth tiếp theo.

---

# 5.3. Project Workflow Completion Workstream

Workstream này là chuỗi triển khai ưu tiên hiện tại. Nó không thay thế số batch lịch sử trong roadmap tổng thể; mỗi phase bên dưới phải được map tới batch hoặc slice tương ứng trong bảng roadmap.

## Phase 1: Membership Foundation

**Trạng thái mục tiêu:** `IN_QA` → `COMPLETE`

Phạm vi:

- Membership authorization trung tâm
- Add/change/revoke membership
- Project Detail member DTO và capability DTO
- Membership management UI
- Project/Phase authorization integration
- Attendance và Project Deadline regression boundary

Acceptance Criteria:

- Thêm thành viên ACTIVE thành công.
- Không tạo duplicate ACTIVE membership.
- Đổi role đúng whitelist.
- Revoke không hard delete và giữ lịch sử.
- Revoke lặp lại được xử lý rõ.
- Cross-project membership mutation bị chặn.
- Project `CANCELLED` readonly.
- UI chỉ dùng capability từ server.
- Không fetch employee list trước khi mở modal.
- Attendance không phụ thuộc `project_members`.
- Project Deadline không regression.
- Test/lint/typecheck/build PASS.
- Manual QA cho add/change/revoke/readonly PASS.

Exit Criteria:

- Không còn P0/P1.
- Membership APIs/UI đã được live verify hoặc có checklist rõ nếu deployment bị chặn.
- Roadmap cập nhật trạng thái `✅ Hoàn thành` hoặc `⚠️ Cần kiểm tra` với blocker cụ thể.
- Có handoff đầy đủ cho Task Assignment Foundation.

Handoff sang Phase 2:

- `project_members` ACTIVE là authority để xác thực assignee thuộc dự án.
- Không dùng tên người hoặc email làm assignment authority.
- Không triển khai assignment trên legacy text field nếu chưa có stable employee identifier.

## Phase 2: Task Assignment Foundation

Phạm vi:

- Child Task
- Assignee
- Deadline
- Comment
- Activity
- Notification foundation

Acceptance Criteria:

- Audit schema task legacy trước khi thay đổi.
- Child task có quan hệ rõ với project/phase/parent task.
- Assignee dùng stable `employee_id` hoặc internal employee PK theo contract đã duyệt.
- Assignee phải là employee ACTIVE và ACTIVE project member.
- Deadline được lưu/đọc thống nhất và hiển thị đúng timezone.
- Comment dùng textarea, có validation và không lộ raw DB error.
- Activity ghi nhận actor, action và timestamp tối thiểu.
- Notification chỉ triển khai foundation trong scope được duyệt; không mở WebSocket/realtime rộng.
- Không làm regression Membership, Attendance, Project Deadline và Phase authorization.
- Có migration/rollback/validation/backfill plan nếu cần schema mới.
- Không chạy live migration nếu chưa được duyệt.

Exit Criteria:

- Task Assignment contract được chốt.
- API/UI/tests PASS.
- Legacy compatibility được ghi rõ.
- Handoff sang Project Workflow nêu rõ task/phase dependencies.

## Phase 3: Project Workflow

Phạm vi:

- Phase transition
- Complete phase
- Lock phase
- Unlock phase
- Sequential workflow

Acceptance Criteria:

- Transition validator nằm ở server/domain boundary.
- Không để client tự quyết định quyền hoặc trạng thái hợp lệ.
- Chỉ mở phase sau khi dependency trước đạt điều kiện.
- Complete/lock/unlock có authorization và audit.
- Project `CANCELLED` readonly.
- Không phá task assignment và membership capability.
- Có transition matrix và regression tests.

Exit Criteria:

- Workflow state machine và quyền đã PASS.
- Không còn transition bypass.
- Handoff UI Polish ghi rõ các state/loading/error cần thể hiện.

## Phase 4: UI Polish

Phạm vi:

- Animation
- Loading
- Skeleton
- Spacing
- Typography
- Responsive
- Dark mode
- Dashboard
- Project detail
- Employee detail

Acceptance Criteria:

- Không thay đổi business logic.
- Dùng shared loading/skeleton/error/empty patterns.
- Không tạo design system song song.
- Desktop, tablet và mobile pass kiểm tra cơ bản.
- Dark mode chỉ hoàn thành khi contrast và readability PASS.
- Dashboard dùng dữ liệu thật, không demo metric.
- Project/Employee Detail giữ nguyên authorization server-side.

Exit Criteria:

- Core pages có UI consistency.
- Accessibility issue nghiêm trọng đã xử lý.
- Handoff Production Hardening ghi rõ performance hot spots còn lại.

## Phase 5: Production Hardening

Phạm vi:

- Cache
- Audit log
- Notification
- Realtime
- WebSocket nếu thực sự cần
- Optimistic update
- Background jobs
- Monitoring
- Performance

Acceptance Criteria:

- Mọi kỹ thuật mới có use case rõ, không thêm chỉ để “đủ stack”.
- Cache có invalidation strategy.
- Optimistic update có rollback/error path.
- Background job có idempotency và retry policy.
- Realtime/WebSocket chỉ dùng nơi polling hoặc invalidation không đủ.
- Audit log có actor/action/entity/time và không chứa secret.
- Có monitoring cho error rate, latency và job failure.
- Request waterfall, N+1 và duplicate fetch được kiểm tra.
- Full regression và production build PASS.

Exit Criteria:

- Release readiness checklist PASS.
- Rollback notes đầy đủ.
- Không còn P0/P1.
- Hệ thống sẵn sàng release theo safe rollout order.

---

# 5.4. Current Active Workstream

Codex phải cập nhật khối này sau mỗi batch trong AUTO_RUN_ROADMAP.

- **Workstream:** Project Workflow Completion
- **Current phase:** Phase 4 - UI Polish / Project Detail Vietnamese-copy polish
- **Current status:** ✅ Application-only Project Detail Vietnamese-copy continuation PASS validation in current PR.
- **Current blocker:** Phase 3 persistence and task-create RPC remain at `LIVE_APPROVAL_REQUIRED` before schema/RLS/backfill/RPC/grant/live mutation. No live mutation is included in this UI slice.
- **Next safe action:** Continue Phase 4 detail/accessibility polish or return to Phase 3 persistence only after live approval.
- **Auto-run target:** Chạy tuần tự Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5, dừng tại mọi `LIVE_APPROVAL_REQUIRED`, P0/P1, migration gate hoặc Git delivery blocker.

---

# 6. Roadmap tổng thể

| Giai đoạn                                                         | Trạng thái | Mô tả                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Prompt cho Codex                                                                                                                                                     | Bước tiếp theo                                                                                                           |
| ----------------------------------------------------------------- | ---------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **0. Chuẩn hóa Guidance**                                         |         ✅ | Audit `AGENTS.md`, skill, references và `SETUP-CODEX-ERP.md`. Phân định authority order, loại bỏ rule trùng và no-op guidance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `Đọc AGENTS.md và SETUP-CODEX-ERP.md. Thực hiện guidance audit. Chỉ phân tích, không sửa application code, không cài dependency và không chạy migration.`            | Refactor các file guidance theo báo cáo audit.                                                                           |
| **0.1. Refactor Guidance**                                        |         ✅ | Giữ `AGENTS.md` là authority order duy nhất. `SKILL.md` làm router. References sở hữu rule chi tiết. SETUP chỉ giữ phase plan và prompt launcher.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `Thực hiện kế hoạch chỉnh sửa guidance đã duyệt. Chỉ sửa các file guidance. Không sửa application code. Sau đó chạy consistency review.`                             | Kiểm tra conflict, duplication và broken references.                                                                     |
| **0.2. Chuẩn hóa tiếng Việt**                                     |         ✅ | Chốt toàn bộ UI dùng tiếng Việt đơn giản. Enum trong code vẫn dùng tiếng Anh nhưng mapping sang label tiếng Việt.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `Cập nhật guidance: tiếng Việt là ngôn ngữ mặc định và duy nhất trên UI. Không hard-code label rải rác. ui-rules.md là nguồn từ vựng chính.`                         | Audit toàn bộ UI chưa Việt hóa.                                                                                          |
| **0.3. Security Guidance**                                        |         ✅ | Bổ sung nguyên tắc frontend không đáng tin cậy, không lộ secret, server authorization, Supabase RLS, private storage và security test matrix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `Bổ sung Security và Data Protection vào guidance. Không sửa application code. Thêm yêu cầu auth, RLS, storage, env, API validation, source maps và security tests.` | Chạy full repository audit.                                                                                              |
| **1. Full Repository Audit**                                      |         ✅ | Audit kiến trúc, Supabase, Auth, Attendance, Payroll, UI, Workflow, RLS, source map, hard-coded status, permission và sensitive data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `Thực hiện Full Repository Audit theo SETUP-CODEX-ERP.md. Chỉ audit. Không sửa code, không migration, không cài dependency.`                                         | Tạo specification foundation.                                                                                            |
| **2. Specification Foundation**                                   |         ✅ | Tạo `spec.md` và `plan.md` cho Supabase, Auth, Attendance, Payroll source of truth.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `Tạo specification “Supabase, Auth, Attendance Payroll Source of Truth Foundation”. Chỉ tạo spec và plan. Chưa sửa code.`                                            | Chốt identity và business rules.                                                                                         |
| **2.1. Chốt Identity**                                            |         ✅ | Dùng `employees.id` làm khóa nội bộ. `employees.auth_user_id` liên kết Supabase Auth. `employee_id` là mã nghiệp vụ. `full_name` chỉ hiển thị.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `Cập nhật spec: employees.id là khóa quan hệ chính; auth_user_id liên kết auth.users; full_name không dùng làm relationship authority.`                              | Chốt payroll và attendance source of truth.                                                                              |
| **2.2. Chốt Payroll và Attendance**                               |         ✅ | Payroll dựa trên attendance evidence, wage history, adjustments và payroll period. Không tự thay đổi công thức hiện tại.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `Cập nhật spec: khóa current payroll behavior bằng fixtures và regression tests. Mọi thay đổi kết quả lương phải chờ duyệt riêng.`                                   | Tạo safe foundation task breakdown.                                                                                      |
| **3. Batch 1: Audit và Test Baseline**                            |         ✅ | Kiểm kê Supabase, env, identity, attendance/payroll formula, source maps. Tạo fixtures và regression test scaffold.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `Bắt đầu Batch 1. Chỉ inventory, audit công thức và tạo regression-test scaffold. Không đổi nghiệp vụ, schema hoặc RLS.`                                             | Review, commit checkpoint.                                                                                               |
| **4. Batch 2: Auth và Data Boundary Hardening**                   |         ✅ | Bỏ admin passcode hard-code, token URL/localStorage, không tin `employeeId` từ frontend, giảm dữ liệu nhạy cảm tải về Client Component.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `Bắt đầu Batch 2. Xử lý security finding Critical. Không thay đổi payroll/attendance calculation hoặc database schema.`                                              | Chuẩn hóa Supabase client boundary.                                                                                      |
| **5. Batch 3A: Supabase Client Boundary**                         |         ✅ | Tách browser/server/middleware client. Ưu tiên publishable key. Anon key chỉ fallback tạm. Build đã PASS.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Bắt đầu Batch 3A. Chuẩn hóa Supabase env contract và client ownership. Không schema, RLS, payroll hoặc UI changes.`                                                 | Thiết kế identity migration và RLS.                                                                                      |
| **6. Batch 3B: Identity và RLS Draft**                            |         ✅ | Thiết kế `auth_user_id`, backfill, RLS matrix, storage policy và security test matrix. Chưa chạy migration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `Bắt đầu Batch 3B. Tạo identity schema draft, backfill plan, RLS policy draft và storage policy draft. Không chạy SQL.`                                              | Audit live schema và migration drift.                                                                                    |
| **7. Batch 3C1: Migration Drift Audit**                           |         ✅ | Chọn live DB làm baseline. Xác định migration history lệch. Không dùng `migration up --linked`. Audit `system_settings`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `Audit migration drift và live schema. Không migration repair, db push, DDL hoặc DML. Tạo reconciliation plan.`                                                      | Bootstrap Owner Auth account.                                                                                            |
| **8. Batch 3C2: Owner Auth Bootstrap**                            |         ✅ | Tạo và xác minh Auth user Tùng Duy bằng email invite. Khớp đúng một Auth user với employee internal ID 3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Xác minh Owner Auth bootstrap theo normalized email. Không map bằng full_name. Chỉ tạo mapping proposal và SQL draft.`                                              | Chuẩn bị migration `auth_user_id`.                                                                                       |
| **9. Batch 3C3: Isolated Auth Mapping Deployment**                |         ✅ | Hoàn thành migration cô lập `employees.auth_user_id`, Owner backfill, validation và migration history repair riêng cho version `20260712181332`. Không chạy migration cũ.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Batch 3C3 đã hoàn thành. Không sửa schema/data/RLS thêm.`                                                                                                           | Batch 3C4 Invite và Password Flow.                                                                                       |
| **10. Batch 3C3 Part 1: Preflight Read-only**                     |         ✅ | Đã kiểm tra bảng, employee ID 3, Auth user, constraint/index name và điều kiện trước migration. Tất cả điều kiện preflight đã PASS.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `Part 1 đã PASS. Tiếp tục Part 2 theo isolated deployment runbook.`                                                                                                  | Đã chuyển sang Part 2.                                                                                                   |
| **11. Batch 3C3 Part 2: Schema Migration Cô lập**                 |         ✅ | Đã chạy riêng migration thêm `employees.auth_user_id` bằng `supabase db query --linked --file`. Không chạy `migration up`, `db push` hoặc migration cũ.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `Part 2 đã chạy thành công. Chạy Part 3 schema validation.`                                                                                                          | Đã chuyển sang Part 3.                                                                                                   |
| **12. Batch 3C3 Part 3: Schema Validation**                       |         ✅ | Schema validation đã PASS bằng query sửa dùng `pg_constraint` và `pg_attribute`. Lỗi cũ là false negative do validation query join `constraint_column_usage` bị mất dòng FK.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `Part 3 đã PASS. Chuẩn bị Part 4 Owner backfill nhưng chưa chạy cho đến khi người dùng duyệt.`                                                                       | Chuẩn bị gate Part 4.                                                                                                    |
| **13. Batch 3C3 Part 4: Owner Backfill**                          |         ✅ | Owner backfill đã chạy trong Supabase SQL Editor. Part 5 validation xác nhận employee ID 3 được map đúng một Auth user, không đổi role/status/email.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `Part 4 đã hoàn thành. Part 5 mapping validation đã PASS.`                                                                                                           | Đã chuyển sang Part 5.                                                                                                   |
| **14. Batch 3C3 Part 5: Mapping Validation**                      |         ✅ | Read-only validation đã PASS: employee ID 3 có đúng một `auth_user_id`, Auth user tồn tại, normalized email khớp, không duplicate/orphan, role `ADMIN`, status `ACTIVE`, không có mapping ngoài employee ID 3.                                                                                                                                                                                                                                                                                                                                                                                                                                            | `Part 5 mapping validation đã PASS. Không sửa dữ liệu, schema, RLS, role hoặc migration history.`                                                                    | Chờ duyệt Part 6.                                                                                                        |
| **15. Batch 3C3 Part 6: Migration History**                       |         ✅ | Đã đánh dấu riêng version `20260712181332` là applied bằng `migration repair`. Hai migration cũ vẫn chưa bị ghi nhận trên remote. Schema và Owner mapping không đổi sau repair.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `Part 6 đã PASS. Không chạy migration SQL, migration up, db push, db reset hoặc repair migration cũ.`                                                                | Batch 3C4 Invite và Password Flow.                                                                                       |
| **16. Batch 3C4: Invite và Password Flow**                        |         ⚠️ | Password setup live PASS. Supabase signIn request PASS. Admin session/navigation đang bị chặn vì `/admin/dashboard` trả 200 nhưng vẫn render form đăng nhập. Không sửa schema hoặc RLS.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `Batch 3C4 chưa hoàn thành. Sửa session/navigation sau đăng nhập rồi deploy để test lại.`                                                                            | Hoàn tất admin session/navigation live verification trước Batch 3D1.                                                     |
| **17. Batch 3C4A: Session UX, Logout và Account Entry**           |         ⚠️ | Publishable key là public env chuẩn; dashboard không được biến query error thành số 0; Admin logout phải signOut local; landing page chọn quản trị/nhân viên. Không sửa schema/RLS/role.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `Deploy và live verify logout, dashboard error state, account selector. Batch 3C4 vẫn bị chặn tới khi login/admin data PASS.`                                        | RLS own-row cho employees nếu live audit xác nhận cần policy.                                                            |
| **17.1. Batch 3C4B: RLS Admin Data Access Slice 1**               |         ✅ | Hoàn thành có điều kiện. Đã rollout helper `public.is_app_admin()` và SELECT policy `"financial ledger admin select"` cho `public.financial_ledger`. Live verification PASS: admin login hoạt động, Dashboard đọc được ledger, RLS slice 1 hoạt động đúng.                                                                                                                                                                                                                                                                                                                                                                                                | `RLS slice 1 đã PASS có điều kiện. Dashboard financial_ledger access đã Hoàn thành.`                                                                                 | RLS slice 2 cho `office_expenses` và `shareholders`.                                                                     |
| **17.2. Batch 3C4C: Ledger Reporting-period Fix**                 |         ✅ | Hoàn thành. Trang Sổ Cái dùng `month_period` làm kỳ nghiệp vụ, không dùng `created_at`; live verification PASS với dữ liệu nhập dồn tháng 6/7 nhưng thuộc kỳ trước.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `Ledger reporting-period fix đã Hoàn thành. Query lỗi không giả thành danh sách rỗng.`                                                                               | Tiếp tục các slice RLS còn lại.                                                                                          |
| **17.3. Batch 3C4D: RLS Admin Data Access Slice 2**               |         ✅ | Hoàn thành có điều kiện. Đã rollout SELECT policy admin cho `public.office_expenses` và `public.shareholders`, tái sử dụng `public.is_app_admin()`. Validation bắt buộc PASS; STAFF ACTIVE và ADMIN/OWNER INACTIVE denial DEFERRED vì chưa có mapped fixture.                                                                                                                                                                                                                                                                                                                                                                                             | `RLS slice 2 đã PASS có điều kiện. Dashboard data access đã Hoàn thành sau live verification.`                                                                       | RLS Workflow slice cho `projects`, `phases` và `tasks`.                                                                  |
| **17.4. Batch 3C4E: Dashboard Server DTO Slice**                  |         ✅ | Hoàn thành. Admin Dashboard đã chuyển data access tài chính sang server-side DTO: server xác minh admin, dùng Supabase server session client và RLS, chỉ trả DTO tối thiểu cho chart/UI. Live verification PASS, gồm DevTools Network xác nhận không còn browser query trực tiếp tới bảng tài chính.                                                                                                                                                                                                                                                                                                                                                      | `Dashboard Server DTO slice PASS hoàn toàn. Dashboard data access đã Hoàn thành.`                                                                                    | RLS Workflow slice cho `projects`, `phases` và `tasks`.                                                                  |
| **17.5. Batch 3C4F: Project Read RLS**                            |         ✅ | Hoàn thành ngày 2026-07-16. Đã rollout đúng Project Read RLS artifact `supabase/migrations/20260716035555_project_rls_pre_run_review.sql`: tạo helper `is_project_member`, `has_project_role`, `can_view_project` và SELECT policy `projects project access select` cho `public.projects`. Không tạo INSERT/UPDATE/DELETE/ALL policy, không sửa grants, không sửa dữ liệu, không sửa `phases`/`tasks`/`staff_tasks` hoặc `project_members` rows. Validation database-state PASS; employee 1/2 và inactive denial DEFERRED do thiếu auth fixture.                                                                                                          | `Project Read RLS đã Hoàn thành. Project Mutation Server Boundary đang làm.`                                                                                         | Project Mutation Server Boundary.                                                                                        |
| **17.5A. Project Mutation Server Boundary**                       |         ✅ | Hoàn thành, chờ deploy. Create/update/archive project đã đi qua API server `app/api/admin/projects/...` và service server-only `services/server/projectMutations.ts`; browser không còn `projects.insert/update/delete/upsert`. Server kiểm tra `ADMIN_WORKSPACE`, `PROJECT_MANAGE`, project membership role, DTO whitelist, archive bằng status update và không mở browser mutation policy.                                                                                                                                                                                                                                                              | `Project Mutation Server Boundary đã Hoàn thành, chờ commit/push/deploy.`                                                                                            | Project Mutation Live Verification.                                                                                      |
| **17.5B. Project Mutation Live Verification**                     |         ⏳ | Chờ. Cần deploy code server route mới rồi live verify create/update/archive với quyền thật, lỗi 401/403/404/409/422/500, và xác nhận secret chỉ server-side.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `Live verification chờ sau deploy.`                                                                                                                                  | Duyệt và chạy live verification.                                                                                         |
| **17.5B1. Task Legacy Schema Alignment**                          |         ✅ | Hoàn thành, chờ deploy. `/admin/tasks` đã được align với live legacy schema `public.tasks`: đọc `project_name`, `assigned_to`, `current_phase`, `estimation_date`, `issue_note`, `packer_assigned`, `created_at`; không còn runtime query/payload giả định `tasks.phase_id`, `tasks.assignee_id`, `tasks.reviewer_id` hoặc `tasks.employee_id`. Project create dùng partial-success UX khi child task template chưa thể khởi tạo, không báo sai project failure và không tạo lại project khi retry child. Không thêm migration, không sửa live data, không triển khai Task RLS.                                                                           | `Task Legacy Schema Alignment = Hoàn thành, chờ deploy. Phase RLS = Chờ tiếp tục.`                                                                                   | Deploy rồi live verify `/admin/tasks`, project create, phase create và task create/deferred UX trước Phase RLS.          |
| **17.5B2. Phase Mutation Membership Authorization**               |         ✅ | Hoàn thành, chờ deploy. Phase create/update/list đã đi qua helper server-only `requirePhaseMutationAccess`: actor derive từ authenticated session, project chưa `CANCELLED`, phase thuộc project trong URL, global `ADMIN_WORKSPACE` + `PROJECT_MANAGE` được phép mutate, project `PROJECT_OWNER`/`PROJECT_MANAGER` được phép mutate, `CREATIVE_LEAD` và `CONTRIBUTOR` chỉ view trong slice này. Không chạy SQL, không chạy migration, không sửa live data.                                                                                                                                                                                               | `Phase Mutation Membership Authorization = Hoàn thành, chờ deploy. Phase Workflow Foundation Migration = Chờ duyệt.`                                                 | Review/deploy application patch trước khi duyệt Phase Workflow Foundation Migration.                                     |
| **17.5C. Phase RLS**                                              |         ⏳ | Chờ tiếp tục. Chưa tạo policy cho `public.phases`; chỉ quay lại sau khi Task Legacy Schema Alignment được deploy và live PASS cho `/admin/tasks`, project create, phase create và task create/deferred UX.                                                                                                                                                                                                                                                                                                                                                                                                                                                | `Phase RLS chờ tiếp tục sau live PASS.`                                                                                                                              | Thiết kế Phase RLS riêng.                                                                                                |
| **17.5D. Task RLS**                                               |         ⏳ | Chờ. Thiết kế RLS riêng cho `public.tasks` và `public.staff_tasks` sau khi Phase RLS live PASS. Không suy luận assignment từ legacy text fields.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `Task RLS chờ sau Phase RLS.`                                                                                                                                        | Task assignment identity foundation.                                                                                     |
| **17.5E. Task Assignment Employee ID Foundation**                 |         ✅ | Hoàn thành ngày 2026-07-20. Schema/persistence foundation đã live PASS trước đó; slice này nối Project Detail vào API task assignment normalized để xem/sửa assignee, deadline, status và comment bằng textarea, giữ legacy fallback read-only, lọc staff non-manager theo assigned task ở server, không thêm migration. Validation npm test/lint/tsc/build/diff-check PASS với warning môi trường đã ghi nhận.                                                                                                                                                                                                                                           | `Task Assignment end-to-end Project Detail workflow đã hoàn thành; chờ PR review/deploy và live QA với feature gate bật.`                                            | Phase 3 project workflow state machine.                                                                                  |
| **17.5F. Project Phase Workflow State Machine Application Slice** |         ✅ | Hoàn thành ngày 2026-07-20. Đã thêm pure helper cho transition map, stage gating, phase/project progress và nối Project Detail vào gate message, latest activity, status-option filtering. Không đổi role matrix, không chạy SQL, không thêm migration/RLS. Phase complete/unlock mutation vẫn chờ design/migration approval.                                                                                                                                                                                                                                                                                                                             | `Project phase workflow state-machine app slice PASS; dừng trước persistence mutation approval gate.`                                                                | Phase status/dependency mutation design và LIVE_APPROVAL_REQUIRED trước SQL/RLS.                                         |
| **17.5G. Phase Status/Dependency Mutation Design**                |         ✅ | Hoàn thành ngày 2026-07-21. Đã chuẩn bị design contract cho status/dependency mutation, transition matrix, audit-history requirement, RLS impact, compatibility/backfill plan và draft-only forward/rollback/validation SQL. Không chạy SQL, không thêm migration thật, không đổi role matrix/RLS/live data.                                                                                                                                                                                                                                                                                                                                              | `Phase status/dependency mutation design PASS; dừng tại LIVE_APPROVAL_REQUIRED trước schema/RLS/backfill.`                                                           | Chờ duyệt live migration/RLS/backfill hoặc chuyển sang slice an toàn khác sau quyết định.                                |
| **17.5I. Project Detail Loading State Polish**                    |         ✅ | Hoàn thành ngày 2026-07-21. Thêm route-level loading skeleton và thay inline refresh loading bằng skeleton khớp layout Project Detail để giữ cấu trúc header/KPI/stepper/member/sidebar khi tải. Không đổi business logic, schema, RLS, feature flag hoặc live data.                                                                                                                                                                                                                                                                                                                                                                                      | `Project Detail UI polish loading-state slice PASS; Phase 3 persistence vẫn ở LIVE_APPROVAL_REQUIRED.`                                                               | Tiếp tục Phase 4 UI polish với empty/error/responsive states hoặc quay lại Phase 3 persistence khi được duyệt live gate. |
| **17.5K. Phase Template Metadata Persistence**                    |         ✅ | Hoàn thành ngày 2026-07-21. Tạo project từ preset application-layer nay lưu/đọc metadata phase thật qua API server: colorway, mã nội bộ, stage type, owner, planned dates, progress, next action và review flag. Template hiển thị/lưu bằng tiếng Việt, không tạo schema/RLS/RPC/backfill/live mutation mới.                                                                                                                                                                                                                                                                                                                                              | `Phase template metadata persistence PASS; chỉ dùng cột phases hiện có và phase authorization hiện có.`                                                              | Tiếp tục Phase 4 responsive/detail consistency hoặc quay lại Phase 3 persistence khi được duyệt live gate.               |
| **17.5J. Project Detail Empty/Error State Polish**                |         ✅ | Hoàn thành ngày 2026-07-21. Chuẩn hóa trạng thái lỗi tải dữ liệu, chưa có phase, chưa có thành viên và phase chưa có công việc qua shared `OperationalState`. Application-only; không đổi business logic, schema, RLS, feature flag hoặc live data. Validation npm test/lint/tsc/build/diff-check PASS với warning môi trường đã ghi nhận.                                                                                                                                                                                                                                                                                                                | `Project Detail UI polish empty/error-state slice PASS; Phase 3/RPC persistence vẫn ở LIVE_APPROVAL_REQUIRED.`                                                       | Tiếp tục responsive/detail consistency hoặc quay lại Phase 3/RPC persistence khi được duyệt live gate.                   |
| **17.5L. Project Detail Responsive Consistency**                  |         ✅ | Hoàn thành ngày 2026-07-21. Chuẩn hóa Project Detail responsive layout: chuyển main/sidebar sang breakpoint XL để tablet giữ nội dung một cột, sidebar sticky trên desktop, metadata phase dùng shared field cards, task mobile cards dùng semantic `article`/`dl` và action full-width dễ bấm. Đồng thời sửa lỗi duplicate helper declaration trong Project Detail. Không đổi business logic, schema, RLS, feature flag hoặc live data.                                                                                                                                                                                                                  | `Project Detail responsive/detail consistency slice PASS; Phase 3/RPC persistence vẫn ở LIVE_APPROVAL_REQUIRED.`                                                     | Tiếp tục Phase 4 detail/action polish hoặc quay lại Phase 3 persistence khi được duyệt live gate.                        |
| **17.5M. Project Detail Task Action Clarity**                     |         ✅ | Hoàn thành ngày 2026-07-21. Modal sửa công việc con nay hiển thị tóm tắt trường sẽ cập nhật, vô hiệu hóa nút lưu khi chưa có thay đổi và chặn submit rỗng bằng thông báo tiếng Việt. Tách helper pure `describeTaskEditIntent` để test được hành vi no-op/change intent. Không đổi API contract, business rule, schema, RLS, feature flag hoặc live data.                                                                                                                                                                                                                                                                                                 | `Project Detail task action clarity slice PASS; Phase 3/RPC persistence vẫn ở LIVE_APPROVAL_REQUIRED.`                                                               | Tiếp tục Phase 4 detail polish hoặc quay lại Phase 3 persistence khi được duyệt live gate.                               |
| **17.5N. Project Detail Member Mobile Polish**                  |         ✅ | Hoàn thành ngày 2026-07-22. Thành viên dự án nay giữ bảng desktop từ breakpoint `md` và có mobile cards cho màn hình nhỏ với tên, trạng thái, chức vụ, vai trò, ngày tham gia, khả dụng giao việc và nút đổi vai trò/thu hồi full-width. Application-only; không đổi server capability, membership mutation contract, business rule, schema, RLS, RPC, backfill, feature flag, Supabase Management API verification hoặc live data. | `Project Detail member mobile polish slice PASS; Phase 3/RPC persistence vẫn ở LIVE_APPROVAL_REQUIRED.`                                                               | Tiếp tục Phase 4 detail/accessibility polish hoặc quay lại Phase 3 persistence khi được duyệt live gate.                 |
| **17.5P. Project Detail Vietnamese Copy Continuation**                  |         ✅ | Hoàn thành ngày 2026-07-23. Tiếp tục polish tiếng Việt ở Project Detail: đổi deadline thành hạn hoàn thành, bỏ wording read-only/derive/hard delete membership/ACTIVE/server mutation/state machine khỏi nội dung người dùng thấy. Application-only; không đổi business logic, authorization, API contract, schema, RLS, RPC, backfill, deployment hoặc live data. | `Project Detail Vietnamese-copy continuation PASS; Phase 3/RPC persistence vẫn ở LIVE_APPROVAL_REQUIRED.`                                                               | Tiếp tục Phase 4 detail/accessibility polish hoặc quay lại Phase 3 persistence khi được duyệt live gate.                 |
| **17.5O. Project Detail Accessibility Polish**                 |         ✅ | Hoàn thành ngày 2026-07-22. Tiến độ dự án có `progressbar` với giá trị hiện tại, modal thêm thành viên và sửa công việc dùng `aria-labelledby`/`aria-describedby`, các select/input/textarea có label liên kết bằng `htmlFor`/`id`. Application-only; không đổi server capability, mutation contract, business rule, schema, RLS, RPC, backfill, feature flag, Supabase Management API verification hoặc live data. | `Project Detail accessibility polish slice PASS; Phase 3/RPC persistence vẫn ở LIVE_APPROVAL_REQUIRED.`                                                               | Tiếp tục Phase 4 detail/accessibility polish hoặc quay lại Phase 3 persistence khi được duyệt live gate.                 |
| **17.5H. Phase Template / Project Workflow Template Foundation**  |         ⏳ | Chờ sau Phase status/dependency mutation decision. Ghi nhận nhu cầu chọn project type và workflow template khi tạo project, preview phases, bật/tắt, đổi tên, kéo thả thứ tự, thêm phase riêng rồi clone phase vào project. Giai đoạn đầu ưu tiên application-layer preset, chưa tạo schema template khi Phase/Task RLS còn đang hoàn thiện.                                                                                                                                                                                                                                                                                                              | `Thiết kế Phase Template / Project Workflow Template foundation. Không triển khai trong Phase RLS hiện tại.`                                                         | Application-layer preset trước; schema template sau.                                                                     |
| **17.6. Access & Permission Foundation Slice 1**                  |         ✅ | Hoàn thành. Đã chạy đúng foundation SQL `20260714082140_access_permission_foundation.sql`: tạo `employee_workspace_access`, `permissions`, `employee_permissions`, helper read-only, RLS và policy SELECT tối thiểu. Không backfill, không thay `is_app_admin()`, không sửa RLS cũ, route, menu, `employees.role` hoặc `project_members`. Validation 16/16 PASS; row count bảng nghiệp vụ không đổi.                                                                                                                                                                                                                                                      | `Access & Permission Foundation Slice 1 đã Hoàn thành. Chưa backfill quyền.`                                                                                         | Current Account Access Backfill.                                                                                         |
| **17.7. Current Account Access Backfill**                         |         ✅ | Hoàn thành. Đã chạy đúng Slice 2 backfill artifact `supabase/backfills/20260714094546_current_account_access_permissions.sql`: tạo 2 workspace access ACTIVE và 17 permission ALLOW ACTIVE cho đúng một tài khoản hiện tại đã map Auth. Không tạo Auth user, không gửi invite, không sửa `employees.role/status/auth_user_id`, `public.is_app_admin()`, finance RLS, routes, middleware, menu hoặc dữ liệu nghiệp vụ. Validation database-state 20/20 PASS; session-context helper checks SKIPPED vì SQL/admin context không có `auth.uid()`.                                                                                                             | `Current Account Access Backfill đã Hoàn thành. Bootstrap rows = 19.`                                                                                                | Runtime Permission Bridge.                                                                                               |
| **17.8. Runtime Permission Bridge**                               |         ✅ | Hoàn thành có điều kiện. Runtime server helper đã đọc `employee_workspace_access` và `employee_permissions`, áp dụng DENY thắng ALLOW, admin gate ưu tiên `ADMIN_WORKSPACE` và giữ legacy ADMIN/OWNER fallback. Staff gate dùng `STAFF_WORKSPACE`; `/staff` là Staff Home thật và `/staff/portal` redirect về `/staff`; Staff login riêng đã bị loại khỏi route tree và login chung resolve workspace mặc định. Navigation hiển thị chuyển khu vực khi user có cả hai workspace. Chưa thay `public.is_app_admin()`, finance RLS hoặc `project_members`.                                                                                                   | `Staff unified authentication đã Hoàn thành có điều kiện. Cần commit/push/deploy để live nhận code.`                                                                 | Employee List Read Bridge SQL rollout.                                                                                   |
| **17.9. Employee List Read Bridge**                               |         ⚠️ | Employee List Read RLS = Hoàn thành. Đã rollout SELECT policy `employees admin employee view select` cho `ADMIN_WORKSPACE` + `EMPLOYEE_VIEW`, giữ own-profile SELECT policy cho Staff. Employee List Read Bridge = Chờ deploy application code: Admin employee page đã chuyển sang Server Component + server DTO `EmployeeListItem`; client không query `employees` trực tiếp.                                                                                                                                                                                                                                                                            | `Live RLS đọc đủ 5 employee records cho target account; application bridge chờ commit/push/deploy.`                                                                  | Employee Account Actions review/deploy.                                                                                  |
| **17.10. Employee Account Actions**                               |         ⚠️ | Hoàn thành có điều kiện phần application code. Account actions chạy server-only qua Supabase Admin client, yêu cầu `ADMIN_WORKSPACE` + `ACCOUNT_MANAGE`; thêm/sửa/vô hiệu hóa yêu cầu `EMPLOYEE_MANAGE`; UI ẩn action theo capability và server kiểm tra lại. Chưa chạy live do phụ thuộc commit/push/deploy và secret env `SUPABASE_SECRET_KEY` hoặc `SUPABASE_SERVICE_ROLE_KEY`.                                                                                                                                                                                                                                                                        | `Employee Account Actions đã sẵn sàng review. Không gửi invite/reset trong lúc triển khai.`                                                                          | Account Permission Management Page.                                                                                      |
| **17.10A. Project Membership Foundation**                         |         ✅ | Hoàn thành ngày 2026-07-15. Đã rollout đúng foundation artifact `supabase/migrations/20260714045636_project_members_foundation.sql`: tạo `public.project_members`, FK tới `projects`/`employees`, role `PROJECT_OWNER`/`PROJECT_MANAGER`/`CREATIVE_LEAD`/`CONTRIBUTOR`, status `ACTIVE`/`REVOKED`, partial unique ACTIVE membership, indexes, audit trigger và RLS tối thiểu cho `ADMIN_WORKSPACE` + `PROJECT_VIEW`/`PROJECT_MANAGE`. Không backfill, không sửa projects/phases/tasks/staff_tasks/employees/attendance/finance/Auth. Validation bắt buộc PASS; `project_members` row count = 0; row count nghiệp vụ và task legacy fingerprint không đổi. | `Project Membership Foundation đã Hoàn thành. Chưa tạo membership rows.`                                                                                             | Project Membership Backfill chờ duyệt riêng.                                                                             |
| **17.10B. Project Membership Backfill**                           |         ✅ | Hoàn thành ngày 2026-07-16. Đã chạy đúng artifact `supabase/backfills/20260715103000_project_members_initial_backfill.sql` một lần: tạo 6 ACTIVE membership đã duyệt cho project 1 và 2, không tạo CONTRIBUTOR, không sửa task assignment hoặc dữ liệu `projects`/`phases`/`tasks`/`staff_tasks`/`employees`/`attendance`/`financial_ledger`. Validation 20/20 PASS; rollback target đúng 6 bootstrap rows.                                                                                                                                                                                                                                               | `Project Membership Backfill đã Hoàn thành. ACTIVE memberships = 6.`                                                                                                 | Project RLS đang làm.                                                                                                    |
| **17.11. Account Permission Management Page**                     |         ⏳ | Trang quản lý workspace access và permission rows cho từng tài khoản. Cần thiết kế riêng để cấp/thu hồi `EMPLOYEE_VIEW`, `EMPLOYEE_MANAGE`, `ACCOUNT_MANAGE` và các permission khác bằng UI có audit rõ ràng.                                                                                                                                                                                                                                                                                                                                                                                                                                             | `Bước tiếp theo sau khi Employee List/Account Actions được deploy và verify.`                                                                                        | Thiết kế permission management UI/API.                                                                                   |
| **18. Batch 3D1: system_settings Runtime Removal**                |         ✅ | Đã loại bỏ runtime dependency khỏi `system_settings`: tắt UI Cấu hình trung tâm, bỏ menu, chuyển SMTP sang server env, chuyển cấu hình VietQR qua API admin đọc env. Bảng và dữ liệu vẫn giữ nguyên.                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `Không đọc/ghi system_settings từ runtime. Không drop bảng/dữ liệu. Không sửa broad policy trong slice này.`                                                         | Duyệt riêng broad-policy remediation.                                                                                    |
| **19. Batch 3D2: system_settings Broad-policy Remediation**       |         🔄 | Đã tạo SQL draft riêng để drop `Allow anon all` và `Allow authenticated all`, kèm rollback và validation/security tests. Chưa chạy SQL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `Review draft policy remediation. Chỉ chạy sau duyệt riêng. Không gộp với runtime removal.`                                                                          | Duyệt và rollout policy slice.                                                                                           |
| **20. Batch 3E1: Own-row RLS**                                    |         ⏳ | Bật RLS an toàn cho `employees`, `attendance`, `attendance_logs`. Staff chỉ xem dữ liệu của mình.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `Triển khai own-row RLS dựa trên auth.uid() → employees.auth_user_id. Không mở payroll/finance toàn hệ thống.`                                                       | Security matrix cho authenticated và wrong-user access.                                                                  |
| **21. Batch 3E2: Payroll và Finance Authorization**               |         ⏳ | Staff chỉ xem payslip của mình. Owner/Admin/Payroll xem theo permission. Project Manager không mặc định xem lương.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `Thiết kế và triển khai server authorization/RLS cho payroll và finance. Không thay đổi payroll calculation.`                                                        | Audit log và regression security tests.                                                                                  |
| **22. Batch 3F: Storage Security**                                |         ⏳ | Private buckets, signed URL ngắn hạn hoặc server-mediated access cho staff docs, payroll, attendance, STL, artwork và formulas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `Audit storage usage và triển khai private access cho dữ liệu nhạy cảm. Không migrate tất cả bucket trong một lượt.`                                                 | Chuyển từng nhóm file.                                                                                                   |
| **23. Batch 3G: QR Check-in Security**                            |         ⏳ | Thay long-lived token bằng short-lived challenge, expiry, nonce, replay protection và server validation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `Thiết kế và triển khai QR check-in an toàn. Không dùng token dài hạn trong URL/localStorage và không tin employeeId từ client.`                                     | Test thiết bị dùng chung và nhân viên chưa đăng nhập.                                                                    |
| **24. Batch 4: Canonical Workflow Domain**                        |         ⏳ | Chuẩn hóa Project, Colorway, Stage, Task, transitions, approval, revision, blocked, reopen và audit history.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `Bắt đầu Workflow Domain phase. Chuẩn hóa canonical statuses, transition validator, approval flow và dependency model. Chưa redesign UI.`                            | Tạo schema draft và migration plan workflow.                                                                             |
| **25. Batch 5: Workflow Backend và Services**                     |         ⏳ | Tách workflow, finance và calculations khỏi UI. Tạo services, permission, activity log và progress calculator.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `Triển khai WorkflowService, transition validator, approval, dependency, audit log và project progress. Không sửa UI ngoài integration cần thiết.`                   | Test business rules.                                                                                                     |
| **26. Batch 6A: SaaS App Shell**                                  |         ⏳ | Tạo sidebar, header, breadcrumb, command menu, notifications và permission-aware navigation theo Shadcn/Efferd.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `Bắt đầu SaaS App Shell. Dùng Efferd Dashboard 2 làm visual reference, không copy demo data. Toàn bộ UI tiếng Việt.`                                                 | Chuyển Dashboard.                                                                                                        |
| **27. Batch 6B: Dashboard ERP**                                   |         ⏳ | KPI thật về dự án, task, approval, production, QC, tồn kho và đơn hàng. Không dùng số liệu demo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `Redesign Dashboard theo Efferd Dashboard 2, chỉ dùng dữ liệu thật. Thêm loading, empty, error, responsive và accessibility.`                                        | Project List và Project Detail.                                                                                          |
| **28. Batch 6C: Project Workflow UI**                             |         ⏳ | Project List, Detail, Workflow View, Kanban, Timeline và My Work.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `Redesign Project UI theo shared patterns. Drag/drop phải validate transition. Trạng thái hiển thị tiếng Việt từ shared vocabulary.`                                 | Operations UI.                                                                                                           |
| **29. Batch 7: Operations Modules**                               |         ⏳ | Production, Print Test, Mold, Casting, QC, Inventory và Assets dùng chung app shell và design system.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `Chuyển các module Operations sang app shell và design system mới. Không tạo design system song song.`                                                               | Commerce, Staff và Finance UI.                                                                                           |
| **30. Batch 8: Commerce, Team và Finance UI**                     |         ⏳ | Products, Colorways, Raffles, Orders, Staff, Attendance, Payroll, Expenses và Reports.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `Chuyển Commerce, Team và Finance sang shared page patterns. Giữ nguyên calculation đã khóa bằng regression tests.`                                                  | Performance và release readiness.                                                                                        |
| **31. Batch 9: Release Hardening**                                |         ⏳ | Accessibility, responsive, performance, rerender, dependency vulnerabilities, demo cleanup và production build.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `Thực hiện release readiness audit: lint, typecheck, tests, build, security matrix, accessibility, responsive và performance.`                                       | Release production theo rollout plan.                                                                                    |

---

# 6.1. Future Design Notes

## Phase Template / Project Workflow Template Foundation

**Trạng thái:** Ghi nhận cho triển khai sau Task Assignment Employee ID Foundation.

**Không thuộc phạm vi hiện tại:** Không triển khai trong Phase RLS hiện tại. Không tạo schema `project_templates`, `phase_templates` hoặc `task_templates` khi Phase/Task RLS chưa hoàn thiện.

### Business goal

Nhiều dự án Artisan Keycap và mô hình in 3D dùng các giai đoạn lặp lại. Khi tạo project, người dùng cần chọn project type và workflow template để hệ thống sinh sẵn phases, nhưng vẫn được chỉnh sửa trước và sau khi áp dụng.

### Target project types

- `ARTISAN_KEYCAP`
- `THREE_D_MODEL`
- `COMMERCIAL_PRODUCT`
- `MEDIA`
- `CUSTOM`

### Target create-project flow

1. Chọn loại dự án.
2. Chọn workflow template.
3. Preview danh sách phase.
4. Bật/tắt từng phase.
5. Đổi tên phase.
6. Kéo thả thứ tự phase.
7. Thêm phase riêng.
8. Áp dụng để clone phase vào `public.phases`.

Sau khi áp dụng, project sở hữu bản phase riêng. Template sửa sau này không làm thay đổi project cũ.

### Phase template fields target

- `name`
- `order_index`
- `description`
- `default_duration_days`
- `is_required`
- `default_role_code`

### Implementation sequence

Giai đoạn đầu dùng application-layer preset để unblock UI và workflow trong lúc hoàn thiện Phase/Task RLS. Giai đoạn sau mới thiết kế schema:

- `project_templates`
- `phase_templates`
- `task_templates` nếu cần
- Trang `/admin/project-templates`

### Initial application-layer presets

`ARTISAN_KEYCAP`:

1. Ý tưởng & Colorway
2. Concept 2D
3. Sculpt 3D
4. Test Print
5. Chỉnh sửa mẫu
6. Làm master
7. Đổ khuôn silicone
8. Test màu & Casting
9. Sản xuất
10. QC
11. Chụp ảnh & Truyền thông
12. Mở bán
13. Đóng gói & Giao hàng

`THREE_D_MODEL`:

1. Tiếp nhận yêu cầu
2. Thu thập reference
3. Blockout
4. Sculpt chi tiết
5. Kiểm tra mesh
6. Chia part
7. Test Print
8. Chỉnh lỗi
9. Hoàn thiện file
10. Bàn giao

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
- Task Legacy Schema Alignment: Hoàn thành, chờ deploy. Live audit xác nhận `public.tasks` là legacy table với PK `id` và không có FK thật tới `projects`/`phases`/`employees`; app đã bỏ runtime read/create giả định `phase_id`, `assignee_id`, `reviewer_id`, `employee_id`, map DTO text `projectName`, `assignedToText`, `currentPhaseText`, `estimationDate`, `issueNote`, `packerAssignedText`, `createdAt`, và giữ project create partial-success khi task template chưa thể khởi tạo. Không thêm migration, không sửa dữ liệu live, không triển khai Task RLS. Phase RLS chờ tiếp tục sau deploy và live PASS.
- Access & Permission Foundation Slice 1: Hoàn thành ngày 2026-07-14. Đã chạy đúng file `supabase/migrations/20260714082140_access_permission_foundation.sql` bằng `npx supabase db query --linked --file`. Object mới: `public.employee_workspace_access`, `public.permissions`, `public.employee_permissions`, trigger helper `public.set_access_permissions_updated_at()`, authorization helpers `public.current_employee_id()`, `public.has_workspace_access(text)`, `public.has_permission(text)`, `public.can_access_admin()`, `public.can_access_staff()`, RLS bật và chỉ có policy SELECT tối thiểu. Validation SQL `supabase/validation/20260714082140_access_permission_foundation_validation.sql` PASS 16/16. Row count trước/sau không đổi: `employees` 5, `financial_ledger` 64, `office_expenses` 2, `shareholders` 2. Chưa có row trong `employee_workspace_access` hoặc `employee_permissions`; chưa chạy backfill.
- Current Account Access Backfill: Hoàn thành ngày 2026-07-14. Đã chạy đúng file `supabase/backfills/20260714094546_current_account_access_permissions.sql`; rollback sẵn tại `supabase/rollbacks/20260714094546_current_account_access_permissions_rollback.sql`; validation dùng `supabase/validation/20260714094546_current_account_access_permissions_validation.sql`. Kết quả: target workspace rows từ 0 lên 2, target permission rows từ 0 lên 17, bootstrap rows 19; row count nghiệp vụ không đổi (`employees` 5, `financial_ledger` 64, `office_expenses` 2, `shareholders` 2); role/status/auth mapping fingerprint không đổi. Không tạo Auth user, không gửi invite, không sửa `project_members` (remote hiện không có bảng này), chưa chuyển runtime bridge.
- Project Membership Foundation: Hoàn thành ngày 2026-07-15. Đã chạy đúng file `supabase/migrations/20260714045636_project_members_foundation.sql`; rollback sẵn tại `supabase/rollbacks/20260714045636_project_members_foundation_rollback.sql`; validation dùng `supabase/validation/20260714045636_project_members_foundation_validation.sql` và các live checks bổ sung. Kết quả: `public.project_members` tồn tại với 0 rows, role/status/check/FK/index/RLS/policy/grant/trigger PASS; row count nghiệp vụ không đổi (`projects` 2, `phases` 0, `tasks` 2, `staff_tasks` 0, `employees` 5, `attendance` 31, `financial_ledger` 64); task legacy fingerprint không đổi. Không chạy backfill membership.
- Project Membership Backfill: Hoàn thành ngày 2026-07-16. Đã chạy đúng file `supabase/backfills/20260715103000_project_members_initial_backfill.sql` một lần; rollback sẵn tại `supabase/rollbacks/20260715103000_project_members_initial_backfill_rollback.sql`; validation dùng `supabase/validation/20260715103000_project_members_initial_backfill_validation.sql` và live checks bổ sung. Kết quả: `PROJECT_OWNER` 2, `PROJECT_MANAGER` 2, `CREATIVE_LEAD` 2, tổng ACTIVE membership 6; mỗi project có đúng 3 membership đã duyệt; không duplicate ACTIVE; không membership ngoài project 1/2 hoặc employee 3/4/6; idempotency check PASS bằng candidate insert count 0; row count và fingerprint các bảng ngoài scope không đổi; rollback target đúng 6 bootstrap rows.
- Runtime Permission Bridge: Hoàn thành có điều kiện ngày 2026-07-15. App runtime đã có server helper `hasWorkspaceAccess`, `requireWorkspaceAccess`, `hasPermission`, `requirePermission`, `canAccessAdmin`, `canAccessStaff`; admin gate dùng `ADMIN_WORKSPACE` với legacy ADMIN/OWNER fallback; staff gate dùng `STAFF_WORKSPACE`; `/staff` là Staff Home và `/staff/portal` redirect server-side về `/staff`; Staff login riêng bị loại khỏi route tree; login chung resolve workspace mặc định. Cần commit/push/deploy để live nhận code mới.
- Employee List Read RLS: Hoàn thành ngày 2026-07-15. Đã chạy `supabase/migrations/20260715030000_rls_employee_admin_view_select.sql`: tạo đúng policy SELECT `employees admin employee view select` cho `has_workspace_access('ADMIN_WORKSPACE')` và `has_permission('EMPLOYEE_VIEW')`; giữ own-profile SELECT policy cho Staff; không tạo write/ALL/anon policy và không sửa dữ liệu employees. Employee List Read Bridge: Chờ deploy application code. Trang `app/admin/employees/page.tsx` là Server Component, đọc qua server DTO và session Supabase client; Client Component chỉ render/filter/action fetch.
- Employee Account Actions: Hoàn thành có điều kiện application code. Route invite/resend/reset/revoke yêu cầu `ACCOUNT_MANAGE`; route create/update/deactivate yêu cầu `EMPLOYEE_MANAGE`; account Auth Admin client server-only dùng secret env, không dùng `NEXT_PUBLIC_*`. Cần review, commit/push/deploy và verify live.
- Account Permission Management Page: Bước tiếp theo để quản lý workspace access và permission rows từ UI thay vì backfill/manual SQL.
- Batch 3D1 system*settings runtime removal: Đã tắt route UI Cấu hình trung tâm, bỏ menu, không còn browser query/mutation `system_settings`; SMTP đọc từ server env `SMTP*\*`; VietQR bank config đọc qua `/api/admin/finance/config`từ env`COMPANY_BANK_CODE`/`COMPANY_BANK_ACCOUNT`; bảng dữ liệu vẫn giữ nguyên.
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

# 2026-07-19 Phase Mutation Membership Authorization Update

Status: Hoan thanh, cho deploy.

Scope completed:

- `requirePhaseMutationAccess` remains the single server-side authorization helper for phase create/update/list and future phase actions.
- Actor identity is derived from the authenticated session, not from client payload.
- Global `ADMIN_WORKSPACE` + `PROJECT_MANAGE` remains allowed.
- `PROJECT_OWNER` and `PROJECT_MANAGER` remain allowed for phase mutations.
- `CREATIVE_LEAD` and `CONTRIBUTOR` remain view-only in this slice.
- Duplicate ACTIVE project membership and invalid ACTIVE role codes now fail closed.
- Future `PHASE_ASSIGN` has a target employee guard requiring ACTIVE employee and ACTIVE project membership.
- Phase API error responses no longer expose raw Supabase/DB error fields.

Validation passed:

- `npm.cmd test`
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npm.cmd run build`

No SQL, migration, live data mutation, commit, push, or deploy was run.

Phase Workflow Foundation Migration remains cho duyet.

## 2026-07-20 Project Membership Management Completion

- Project Membership Management completion branch centralizes role/capability checks in a server-owned helper, adds list/add/change/revoke server routes, and exposes Project Detail membership UI without hard delete or client-side role inference.
- Attendance boundary remains COMPLETE: Staff Attendance stays behind authenticated ACTIVE employee + `STAFF_WORKSPACE` + attendance state only, with no `project_members`, project, phase, task, `PROJECT_VIEW`, or `PROJECT_MANAGE` dependency.
- Task Assignment Foundation is deferred to a separate approved migration package; this branch only documents the handoff and does not run SQL.

## 2026-07-20 Task Assignment Foundation Application Prep

- Target phase: Phase 2 Task Assignment Foundation.
- Application-only scope prepared: shared task assignment DTOs, payload validation, server route contracts, server migration gate and feature flag boundary.
- Draft migration package prepared only under `supabase/drafts/`: forward SQL, rollback SQL, validation SQL and backfill strategy.
- Runtime remains disabled by default through `TASK_ASSIGNMENT_FOUNDATION_ENABLED !== 'true'`; APIs return a sanitized migration-required conflict after server authorization instead of touching missing schema.
- Database impact: draft only. No SQL executed, no migration applied, no backfill, no live task reassignment and no production mutation.
- Exit status: `LIVE_APPROVAL_REQUIRED` before enabling Phase 2 writes or continuing to Phase 3 Project Workflow.

## 2026-07-20 Task Assignment Foundation Completion

- Phase 2 Task Assignment Foundation completed: migration applied, obsolete trial rows removed with approval, validation passed, and server persistence wired behind `TASK_ASSIGNMENT_FOUNDATION_ENABLED`.

## 2026-07-20 Phase 3 Project Workflow Start

- Phase 3 started with the Project Create Reliability slice.
- Duplicate project display names are no longer blocked in server create flow; stable `projects.id` remains the identity boundary because no approved project-code schema exists yet.
- `/admin/projects` now groups duplicate project names by stable project key instead of name, refreshes after create/cancel, and uses Vietnamese project-create validation messages.
- Root notification and confirmation overlays remain portal-based and now use the explicit `z-index: 999999` requirement.
- No schema migration, RLS mutation, production deployment, or project-code migration was run.
- Project Phase Workflow State Machine Application Slice: Hoàn thành ngày 2026-07-20. Project Detail dùng transition map để lọc trạng thái task, hiển thị stage gating và latest activity, project progress tính từ phase progress/task progress. Không đổi role matrix, không chạy SQL/RLS/migration.
- Phase Status/Dependency Mutation Design: Hoàn thành ngày 2026-07-21. Đã chuẩn bị design contract, transition matrix, audit-history plan, RLS impact và draft-only forward/rollback/validation SQL. Không chạy SQL/RLS/migration/backfill/live data mutation.
- Current gate: `LIVE_APPROVAL_REQUIRED` before any phase status/dependency schema change, RLS policy, backfill, or live phase mutation.
- Phase 4 Project Detail Loading State Polish: Hoàn thành ngày 2026-07-21. Thêm route-level skeleton và inline refresh skeleton khớp layout Project Detail; không đổi business logic, feature flag, schema, RLS, backfill hoặc live data.
- Phase 4 Project Detail Empty/Error State Polish: Hoàn thành ngày 2026-07-21. Chuẩn hóa error/empty states qua shared `OperationalState`; không đổi business logic, feature flag, schema, RLS, RPC, backfill hoặc live data.
- Phase 4 Phase Template Metadata Persistence: Hoàn thành ngày 2026-07-21. Project create từ preset application-layer lưu/đọc metadata phase trên cột `phases` hiện có để Project Detail không mất colorway/stage/deadline/next-action sau refresh; không đổi schema, RLS, RPC, feature flag hoặc live data.

## 2026-07-21 Review Debt Remediation Sweep

- Scope: consolidated remediation for available actionable Codex review findings affecting Task Assignment, Project Workflow identity, notification stacking, validation, and authorization seams.
- Review source: `REVIEW_SOURCE_UNAVAILABLE` for old merged PR conversations because this checkout has no GitHub CLI/remote integration available to retrieve historical unresolved review threads. Remediation proceeded only from the explicit task context and repository documentation.
- Completed application fixes: explicit task assignee FK embed, persisted-status transition validation, assignee ACTIVE membership plus eligible employee checks, parent-task cycle prevention, explicit assignment intent validation, no-op update rejection before audit writes, and shared overlay z-index constants with notifications above confirmations.
- Atomic create status: non-atomic task creation is blocked at the application contract with `task_assignment_atomic_create_required`; draft-only RPC artifact prepared for review.
- Database impact: draft SQL only. No SQL executed, no migration applied, no RLS/grant/backfill/live data mutation performed.
- Security impact: no role matrix expansion; server-side authorization boundaries preserved; raw Supabase errors remain sanitized to safe codes.
- Current gate: `LIVE_APPROVAL_REQUIRED` before deploying the task-create RPC, grants, RLS changes, or any live mutation.

- Phase 4 Project Detail Task Action Clarity: Hoàn thành ngày 2026-07-21. Modal sửa công việc con hiển thị tóm tắt intent cập nhật, disable lưu khi no-op và giữ chặn no-op trong handler. Không đổi business logic, API contract, schema, RLS, RPC, backfill hoặc live data.
- Phase 4 Project Detail Member Mobile Polish: Hoàn thành ngày 2026-07-22. Thành viên dự án có mobile cards riêng dưới breakpoint `md`, giữ server capability/membership contract không đổi và không chạy schema/RLS/RPC/backfill/live mutation.
- Phase 4 Project Detail Accessibility Polish: Hoàn thành ngày 2026-07-22. Tiến độ dự án, modal thêm thành viên và modal sửa công việc có tên/mô tả/label form rõ hơn cho accessibility; không đổi business logic, API, schema, RLS, RPC, backfill hoặc live data.

## 2026-07-21 Repository-wide Codex review-debt remediation sweep

Review-debt remediation only; unrelated roadmap implementation was not continued.

- Created `docs/CODE_REVIEW_REMEDIATION.md` as the consolidated remediation evidence table for previously merged Codex review debt inspected during this slice.
- Code Review workflow findings were unavailable in this environment (`REVIEW_SOURCE_UNAVAILABLE`), so the sweep verified the current main-equivalent checkout against merged handoffs and the required review areas supplied in the task.
- Verified Task Assignment Foundation, Project identity/workflow, phase metadata compatibility, phase status persistence gates, partial-persistence/fake-success protections, and overlay infrastructure.
- Fixed the remaining actionable overlay ordering issue by keeping notification toasts at `z-index: 999999` and lowering confirmation backdrops to `999998`, making toast-above-dialog ordering explicit.
- Preserved all live gates: no SQL, migration, RLS, grant, RPC deployment, backfill, production deployment, or live data mutation was run.

Validation target for this remediation PR: targeted Vitest, `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`. The actionable overlay fix remains `AWAITING_NEW_CODE_REVIEW` and must not be marked `FIXED_AND_REVIEWED` until a new Codex Review result is available for the remediation PR and no equivalent P0/P1 remains.

## 2026-07-21 Corrective Slice 1 project authorization and workspace semantics

- Scope: application-only correction for project authorization, phase loading failure handling, and account workspace semantics.
- Completed: System Owner global project/phase access preserved; Application Admin `ADMIN_WORKSPACE` + `PROJECT_VIEW` can read all projects/phases without project membership; Application Admin read access does not grant mutation capabilities; Project Manager/Creative Lead/Contributor membership boundaries remain unchanged.
- Completed: phase request failures preserve already loaded project data through sanitized placeholder workflow records with error code, failure stage, and Vietnamese message; phase route responses do not expose raw Supabase/PostgreSQL error text.
- Completed: account list simplified to employee identity, Auth state, Staff Workspace badge, Admin Workspace badge, preset, permission count, and one actions menu for permission, password reset, workspace grant/revoke, and full access revoke.
- Database impact: none. No schema, RLS, migration, permission backfill, Auth mutation, or live data mutation was run.
- Security impact: read-only project/phase loading now uses read permissions; protected owner access remains separate from Application Admin permissions; workspace access rows remain independent.
- Corrective Slice 2 and Corrective Slice 3 were recorded in the handoff only and not implemented.

## 2026-07-21 Corrective Slice 2 employee profile and account lifecycle

- Corrective Slice 2: Hoàn thành application-only. Employee profile creation is separated from Auth invitation: create persists `employees` with `auth_user_id = null`, shows `Chưa kết nối`, and does not send an invitation unless `Mời sử dụng hệ thống` is explicitly selected later.
- Validation and API contract now return stable safe codes and sanitized failure stages for required fields, invalid email/status, duplicate active email, soft-deleted duplicate review/restore, missing `EMPLOYEE_MANAGE`, persistence failure, invitation failure, and Auth connection failure.
- Quick edit is limited to identity/contact/job/status fields; salary, bank, contract, permission, workspace, salary history, HR document, and audit-history work remains dedicated profile/full-detail scope.
- Account connection remains behind `ACCOUNT_MANAGE`; invitation and password reset are separate actions, retryable, and do not grant Staff Workspace, Admin Workspace, presets, or custom permissions merely by connecting Auth.
- No schema, RLS, migration, salary-history/bank-detail table, Auth backfill, permission backfill, live mutation, deployment, or production SQL was executed.
- Future Corrective Slice 3 remains recorded only: task assignee selection, task deadline/status, finance beneficiary, payer/executor, creator, reimbursement requester/recipient, employee-derived payment QR, receipts, and reimbursement requests.

## 2026-07-21 Corrective Slice 3A project creation/task assignment gate

- Scope: Project creation, task assignment, deadlines, subtasks, comments, and detail semantics.
- Status: `LIVE_APPROVAL_REQUIRED` for full persistence because atomic create requires a transactional RPC/schema contract before the app can create project + phases + tasks + comments without partial writes.
- Completed application guard: `createWorkflowProject` now rejects phase/template-task project creation with `project_creation_atomic_rpc_required` before project insert, so APIs/UI do not return fake success or leave partial projects when child persistence is required.
- Completed UI contract: create-project dialog copy now uses Vietnamese project semantics, includes project code, project deadline, project manager/creative lead/member-oriented fields, disables close/submit while saving, and surfaces the atomic RPC gate through the toast path.
- Prepared artifacts: draft forward, rollback, validation, and backfill plan files under `supabase/drafts/20260721_project_creation_atomic_*`.
- Database impact: none executed. No schema, RLS, migration, RPC, grant, backfill, destructive cleanup, feature flag enablement, deployment, or live data mutation was run.
- Future Corrective Slice 3B recorded only: finance beneficiary, payer/executor, record creator, reimbursement requester/recipient, employee-derived payment QR, receipt and invoice uploads, reimbursement request workflow, approval states, and payment states.
- Next step: review/approve the transactional RPC/schema package, then resume Slice 3A implementation after `LIVE_APPROVAL_REQUIRED` is cleared.

## 2026-07-21 Corrective Slice 3A transactional project creation complete

Status: ✅ Hoàn thành

Completed scope:

- Applied the approved live Corrective Slice 3A atomic project creation package to Supabase project `kwfmfmpgpbfewpiizesv` (`Luminal Factory`) through the Supabase Management API HTTPS mutation path.
- Added required stable `projects.project_code` support and a unique code index while preserving duplicate project display names.
- Deployed `public.create_project_atomic(p_payload jsonb)` with authenticated-only execute grants.
- Wired application project creation to the real transactional RPC and removed the legacy direct project-insert success path for new project creation.
- Updated reviewed forward, rollback, and validation artifacts for the applied package.

Validation evidence:

- Live read-only validation confirmed RPC presence/signature, authenticated execute grant, anon execute denial, required project-code column, unique index, no broad anon browser mutation policies, and no orphan phases/tasks/members/comments/notifications in checked project workflow tables.
- Repository validation must remain the gate before PR delivery: targeted Vitest, `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`.

Database impact: approved schema/RPC/grant mutation only for Corrective Slice 3A.
Security impact: server/authenticated RPC derives actor from `auth.uid()` and checks existing workspace/permission helpers; no broad browser write policy was introduced.
Blocking: `REVIEW_SOURCE_UNAVAILABLE` for connected Code Review workflow findings. Do not begin Corrective Slice 3B from this slice.

## 2026-07-21 Corrective Slice 3B finance beneficiary, payer, reimbursement and receipts

Completed application-only finance workflow correction/preparation from the latest main-equivalent branch after Slices 1, 2, and 3A were already complete.

- Added a typed finance workflow contract that separates Beneficiary, Payer / payment executor, Record creator, Reimbursement requester, Reimbursement recipient, Approver, and Payment confirmer instead of collapsing them into one generic employee field.
- Added category-aware validation for salary, reimbursement, supplier payment, personal advance, project/material/operating expense, and other approved expense categories.
- Salary QR generation now uses the beneficiary employee payment profile helper and returns the required Vietnamese warning `Nhân sự chưa có thông tin nhận tiền.` when bank/payment information is missing.
- Reimbursement status transition rules now require rejection reasons, approval permission, finance payment-confirmation permission, and block requester self-approval/self-payment confirmation.
- Receipt/attachment validation now covers allowed image/PDF types, maximum 10 MB size, and safe filename handling.
- The finance add/edit dialog is now organized into `Thông tin khoản chi`, `Người liên quan`, `Thanh toán`, `Chứng từ`, and `Phê duyệt và lịch sử` sections with the required Vietnamese role copy.
- Prepared draft-only forward, rollback, validation, compatibility/backfill, RLS, and attachment storage policy artifacts under `supabase/drafts/20260721_finance_expense_workflow_*` and `docs/corrective-slice-3b-finance-workflow-handoff.md`.

No SQL was executed. No schema change, RLS change, storage bucket/policy change, transactional RPC, permission backfill, finance backfill, live data mutation, destructive cleanup, deployment, or production mutation was run.

Current gate: `LIVE_APPROVAL_REQUIRED` before applying the finance workflow schema/RLS/storage/RPC/backfill package.

## 2026-07-21 Corrective Slice 4 project execution workflow

Status: ✅ Hoàn thành application-only.

- Project Detail now surfaces production execution metadata for phases and tasks: phase progress/status/owner/deadline/task totals/completed/overdue counts, and task assignee/deadline/status/priority/dependency/last update using shared task display helpers instead of duplicating table/mobile logic.
- Project summary now derives total, completed, in-progress, blocked, overdue, completion percentage, phase completion, member workload, and upcoming-deadline metrics from stable task identifiers where available.
- Task assignment UX supports assign, change assignee, remove assignee, deadline editing, assignment history/audit evidence through `project_activity`, notification hooks through `task_notifications`, and bulk-assignment preparation via reusable execution metrics/member workload without adding live schema.
- Server task mutation paths continue to derive actor identity server-side, validate assignee ACTIVE project membership, prevent invalid parent/cycle transitions, and now reject edits to completed tasks unless a manager mutation supplies explicit override evidence.
- No SQL, migration, RLS, grant, RPC, backfill, live data mutation, deployment, or production mutation was run.

Stop point: Corrective Slice 4 only. Do not continue unrelated roadmap work.

## 2026-07-22 Corrective Slice 5 account workspace preset and permission management

- Completed application-only hardening for account/workspace/preset/permission management. Employee profiles, Auth connections, Staff Workspace access, Admin Workspace access, role presets, custom overrides, project membership roles, and protected System Owner status remain separate concepts.
- Server mutations still derive the actor through the authenticated server context and require `ACCOUNT_MANAGE`; ordinary account-management actions now reject protected System Owner mutation, self-lockout, unknown permission keys, no-op changes, and duplicate active row creation while preserving DENY semantics and sanitized Vietnamese errors.
- Preset application now changes permission rows only and does not silently grant or revoke Staff/Admin workspace access. Workspace changes do not alter presets.
- Presets were rebalanced: HR is limited to employee/account/attendance capabilities, Project Manager is limited to project capabilities, Creative Lead is review/assignment oriented without global project management, Staff remains Staff Workspace only, and Custom is visible.
- Prepared draft-only task permission catalog forward/rollback/validation artifacts under `supabase/drafts/20260722_corrective_slice_5_permission_catalog_*`. Runtime task/reimbursement permission keys remain `LIVE_APPROVAL_REQUIRED` because adding approved catalog keys/backfills is a live schema/data boundary.

Stop point: Corrective Slice 5 only. Do not begin Production Order or another roadmap slice.

## 2026-07-22 Corrective Slice 5 permission contract repair before live catalog rollout

Status: application contract and reviewed artifact preparation complete; live rollout not executed.

- Added approved task permission keys `TASK_VIEW`, `TASK_MANAGE`, `TASK_ASSIGN`, `TASK_REVIEW` and approved reimbursement keys `REIMBURSEMENT_SUBMIT`, `REIMBURSEMENT_REVIEW`, `REIMBURSEMENT_APPROVE`, `REIMBURSEMENT_MARK_PAID` to the canonical application permission contract, editor grouping, Vietnamese labels, preset model, server-side permission whitelist, and effective-permission paths.
- Presets are conservative: Administrator has all ordinary application permissions; HR has no reimbursement approval/payment by default; Project Manager and Creative Lead have approved task permissions; Staff has only `TASK_VIEW` and `REIMBURSEMENT_SUBMIT` by default. Preset application remains separate from workspace grants.
- Reimbursement approval permission and payment-confirmation permission are separate in application validation; requester self-approval remains blocked by default.
- Repaired Slice 5 forward, rollback, and validation SQL artifacts under `supabase/drafts/20260722_corrective_slice_5_permission_catalog_*` so they match the approved eight-key application contract and include preset-mapping validation, conflict/compatibility notes, workspace-grant no-change validation, System Owner protection validation, unexpected-access validation, and DENY-precedence validation.

No SQL was executed. No live permission catalog, employee permission row, workspace grant, RLS, migration, backfill, deployment, or production data was mutated. Current gate: `LIVE_APPROVAL_REQUIRED` before reviewed permission-catalog rollout.

## 2026-07-22 Corrective Slice 5 live permission catalog rollout

Status: ✅ Live catalog package applied through the Supabase Management API HTTPS database query path; no deployment performed.

- Pre-validation passed before rollout: live schema contained the required permission and employee-permission columns, `public.permissions` kept a primary-key duplicate guard, the eight approved task/reimbursement keys were absent, no employee permission rows referenced those keys, and `public.has_permission(text)` retained DENY precedence.
- Applied only the reviewed forward artifact `supabase/drafts/20260722_corrective_slice_5_permission_catalog_forward.sql` under the granted `LIVE_APPROVAL` boundary for the eight approved keys: `TASK_VIEW`, `TASK_MANAGE`, `TASK_ASSIGN`, `TASK_REVIEW`, `REIMBURSEMENT_SUBMIT`, `REIMBURSEMENT_REVIEW`, `REIMBURSEMENT_APPROVE`, and `REIMBURSEMENT_MARK_PAID`.
- Post-validation passed: live catalog now has exactly 25 canonical application permission rows, each approved key exists exactly once, no unknown duplicate key exists, application contract and live catalog align, reviewed preset mappings contain only approved application keys, and DENY precedence remains intact.
- Guard validation passed: `employee_permissions` stayed at 17 rows, `employee_workspace_access` stayed at 4 rows, approved keys have no employee permission assignments, no workspace grant changed, no unexpected preset expansion occurred, and System Owner protection remains an application guard.

No deploy, RLS mutation, workspace mutation, employee permission assignment, preset application, backfill, rollback, destructive operation, or direct `main` push was performed.

## 2026-07-22 Corrective Slice 6 production order and colorway workflow

Status: ✅ Hoàn thành application-only.

- Added a production-order workflow domain contract for stable production order IDs/codes, product or collection, colorway, linked project, quantity, deadline, priority, status, managers/leads/members, notes, attachments, activity, material requirement placeholders, and notification de-duplication.
- Added reusable approved workflow-template preview support, including the artisan keycap workflow as data rather than UI-hardcoded steps; blank and clone sources remain supported through the same preview boundary.
- Added sequential stage-gating helpers for READY/LOCKED/IN_PROGRESS/PENDING_REVIEW/COMPLETED/SKIPPED_WITH_APPROVAL behavior, required-task completion checks, review approval checks, locked-stage edit prevention, duplicate active-stage prevention, active member assignment validation, override reasons, and progress/dashboard/detail summaries.
- Production-order persistence is intentionally exposed through a single atomic adapter boundary that checks duplicate production codes before delegating to the approved transactional persistence seam. No second competing persistence path was added.
- Inventory/material integration remains a placeholder list on the production order draft only; no stock mutation or parallel inventory system was introduced.

No SQL, migration, RLS change, RPC creation, inventory mutation, backfill, feature flag enablement, live data mutation, destructive cleanup, deployment, or production mutation was run.

Management API verification status: `MANAGEMENT_API_UNAVAILABLE` for Cloudflare Error 1010 / `browser_signature_banned` or another confirmed infrastructure restriction unrelated to repository correctness. Skip only Management API project metadata and health verification; continue from the reviewed migration package, rollback package, validation SQL, compatibility/backfill plan, application contract, and reviewed RPC contract. Live SQL/RPC deployment still requires explicit `LIVE_APPROVAL_REQUIRED`, and validation failures unrelated to the Management API limitation must not be ignored.

Stop point: Corrective Slice 6 only. Future schema/RPC/inventory persistence remains `LIVE_APPROVAL_REQUIRED` with forward, rollback, validation, security, and backfill artifacts before execution.

### 2026-07-22 Corrective Slice 6 live persistence continuation

- **Status:** `BLOCKED_MISSING_REVIEWED_ARTIFACT`.
- **Preflight result:** Management API project metadata confirmed `Luminal Factory` (`kwfmfmpgpbfewpiizesv`) as `ACTIVE_HEALTHY`; `npx supabase --version` returned `2.109.1`; local `supabase/.temp/project-ref` matched `SUPABASE_PROJECT_REF`; read-only Management API SQL query succeeded and found no equivalent production-order migration objects in the checked catalog.
- **Blocker:** The repository does not contain the reviewed Corrective Slice 6 forward, rollback, validation, compatibility/backfill, RLS/security, attachment-policy, notification-outbox, or RPC artifacts required by the approved live scope.
- **Safety result:** Stopped before live mutation as required. No production SQL, RLS mutation, RPC deployment, backfill, inventory quantity mutation, application durable-adapter wiring, persistence-gate removal, deployment, or live data mutation was executed.
- **Next allowed action:** Provide or commit the reviewed Corrective Slice 6 persistence artifact package, then rerun read-only pre-validation before applying the approved package through the Management API database query path.

### 2026-07-22 Corrective Slice 6 reviewed persistence package

- **Status:** `LIVE_APPROVAL_REQUIRED`.
- **Completed:** Prepared the reviewed draft persistence package at `supabase/drafts/corrective-slice-6-production-order-persistence/` with `forward.sql`, `rollback.sql`, `validation.sql`, `compatibility.sql`, `security/RLS.sql`, `attachment-policy.sql`, `notification-outbox.sql`, `backfill-plan.md`, and `REVIEW.md`.
- **Design:** Reuses existing `projects`, `phases`, `tasks`, `project_members`, `project_activity`, and `task_notifications`; adds durable production-order/template/stage/member/dependency/attachment metadata tables only where no compatible existing owner exists.
- **Safety:** No SQL was executed, no migration was run, no deployment occurred, no live data changed, no inventory quantity mutation was introduced, and no public attachment access or broad browser write policy was prepared.
- **Next gate:** Before application wiring or live rollout, rerun read-only pre-validation and apply only this reviewed package after explicit `LIVE_APPROVAL_REQUIRED` approval.

### 2026-07-22 Corrective Slice 6 live package execution attempt

- **Status:** `LIVE_EXECUTION_BLOCKED_BY_DATABASE_NETWORK`.
- **Approved scope preserved:** attempted only the reviewed Corrective Slice 6 production-order persistence package under `supabase/drafts/corrective-slice-6-production-order-persistence/`; no application logic, workflow redesign, inventory mutation, Slice 7 work, or unreviewed SQL was performed.
- **Execution blocker:** `npx supabase db query --linked --file supabase/drafts/corrective-slice-6-production-order-persistence/forward.sql` reached linked-project login-role initialization, then failed repeatedly during database connection with `TypeError: null is not an object (evaluating 'context')` from `internalConnectMultipleTimeout`. A direct TCP probe to `aws-1-ap-northeast-1.pooler.supabase.com:5432` returned `Network is unreachable`.
- **Validation impact:** live post-apply verification for production order creation, workflow template creation, stage transitions, production member assignment, attachment metadata, notification outbox, permission enforcement, duplicate protection, and rollback safety remains incomplete because the approved SQL package could not be applied from this environment.
- **Next gate:** rerun the exact reviewed Slice 6 package from a network path that can reach the Supabase database/pooler, then run the complete validation suite. Do not continue Slice 7.

### 2026-07-22 Corrective Slice 6 GitHub Integration delivery path

- **Status:** `APPROVED_FORWARD_PROMOTED_FOR_GITHUB_INTEGRATION`.
- **Environment classification:** `DATABASE_TCP_UNAVAILABLE`. The Supabase IPv4 Session Pooler settings are confirmed correct, but Codex Cloud cannot open outbound PostgreSQL TCP connections and returns `Network is unreachable`. This is not a repository blocker for application-only work and is not a Supabase credential, IPv6, or URL-shape failure.
- **Delivery path:** promoted the approved reviewed forward package to `supabase/migrations/20260722110928_corrective_slice_6_production_order_persistence.sql`. Rollback and validation artifacts remain outside `supabase/migrations/` under the reviewed Slice 6 package directory.
- **Production execution:** no direct SQL execution from Codex Cloud. Production migration execution occurs only through the configured Supabase GitHub Integration after the approved pull request merges into protected `main`.
- **Validation coverage:** static regression coverage confirms the canonical migration matches the reviewed forward package, excludes rollback/validation SQL, excludes unapproved draft SQL markers, avoids broad browser write policies, and contains no inventory quantity mutation.
- **Stop point:** Corrective Slice 6 delivery only. Do not continue Slice 7 until GitHub Integration migration delivery and post-deployment validation pass.


## 2026-07-23 Slice 3 through Slice 6 review-remediation closure

Status: documentation-only review refresh complete. The latest supplied PR diff/comment bundle for the current remediation commit contained no inline comments or newly actionable Codex Code Review findings for Corrective Slice 3, Slice 3B, Slice 4, Slice 5, or Slice 6. Those slices are closed for this remediation sweep. Existing live gates remain unchanged: task atomicity and production-order live execution still require their separate approval/network paths. Slice 7 was not started.

No application code, SQL execution, migration execution, RLS mutation, schema mutation, backfill, deployment, production-data mutation, inventory quantity mutation, or completed-slice redesign was performed.

## 2026-07-23 Corrective Slice 7 project detail phase edit accessibility

Status: application-only Corrective Slice 7 complete. Continued the roadmap's next safe Phase 4 Project Detail accessibility polish without revisiting completed Corrective Slices 3 through 6.

Completed:

- Added an accessible region name for inline selected-phase editing.
- Connected phase-name and phase-order controls to explicit labels while preserving the compact Vietnamese UI.
- Added explicit button types for inline phase edit actions.
- Extended existing static Project Detail accessibility regression coverage.

Database impact: none. No schema, RPC, RLS, storage, backfill, migration execution, production SQL, deployment, or live data mutation was performed.

Security impact: mutation authority remains server-side and unchanged. No client-side permission expansion, service-role exposure, workspace grant, employee permission assignment, or production data mutation was introduced.

Validation: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check` PASS.

Stop point: Corrective Slice 7 only. Do not continue beyond Slice 7 without a new explicit roadmap instruction.

## 2026-07-23 Corrective Slice 8 project detail deadline and Drive accessibility polish

Status: application-only Corrective Slice 8 complete. Continued from the latest main-equivalent state after Corrective Slice 7 with a small Project Detail accessibility and Vietnamese-copy polish.

Completed:

- Replaced remaining user-visible Project Detail deadline labels in the selected-phase task area, unassigned-task summary, project metadata cards, and edit-task modal with Vietnamese wording.
- Connected the Project Detail Google Drive field to an explicit accessible label and made the save action an explicit non-submit button.
- Extended the existing static Project Detail accessibility regression coverage for the Drive label, Drive save button type, and remaining raw `Deadline` table/modal labels.

Database impact: none. No schema, RPC, RLS, storage, backfill, migration execution, production SQL, deployment, or live data mutation was performed.

Security impact: project mutation authority remains server-side and unchanged. No client-side permission expansion, service-role exposure, workspace grant, employee permission assignment, or production data mutation was introduced.

Validation: targeted Vitest, `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check` PASS.

Stop point: Corrective Slice 8 only. Do not continue beyond Slice 8 without a new explicit roadmap instruction.

## 2026-07-23 Corrective Slice 9 project detail Vietnamese-copy polish

Status: application-only Corrective Slice 9 complete. Continued from the latest main-equivalent state after Corrective Slice 8 with a small Project Detail Vietnamese-copy polish.

Completed:

- Replaced user-visible technical English in Project Detail task-gating, empty-state, unassigned-task, workflow-warning, and dialog helper copy with simple Vietnamese.
- Preserved allowed brand wording such as Google Drive and kept implementation identifiers unchanged in code.
- Extended existing static Project Detail regression coverage to prevent the replaced English guidance phrases from returning.

Database impact: none. No schema, RPC, RLS, storage, backfill, migration execution, production SQL, deployment, or live data mutation was performed.

Security impact: project, membership, task, phase, and permission mutation authority remains unchanged. No client-side permission expansion, service-role exposure, workspace grant, employee permission assignment, or production data mutation was introduced.

Validation: targeted Vitest, `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check` PASS.

Next safe action: continue the next safe Phase 4 Project Detail UI/accessibility polish slice, or return to Phase 3 persistence only after explicit live approval.

## 2026-07-23 Administration IA and configuration correction slice

- Completed a safe application-only correction for administration information architecture and configuration wording.
- Admin navigation now groups existing destinations by business domain: Tổng quan, Dự án & sản xuất, Nhân sự, Tài chính, and Cấu hình hệ thống. Existing route paths were preserved.
- Account management copy now separates cổng nhân viên, trang quản trị, preset vai trò, effective permission count, account status, and access status. Account list pagination defaults to 10 with 10/20/50 choices.
- System catalog UI primary wording is now `Danh mục hệ thống`; primary `DB` terminology was removed from the page/menu labels.
- Attendance/facility integration remains on the existing shared `facilities` source; no hardcoded workplace list was introduced.
- No SQL, migration, RLS, RPC, live catalog backfill, facility mutation, Auth mutation, permission mutation, deployment, destructive operation, or production data mutation was executed. Further schema-backed catalog/facility expansion remains `LIVE_APPROVAL_REQUIRED`.

## 2026-07-23 Facility administration server-boundary hardening

Status: application-only facility administration hardening complete. Continued from the latest main-equivalent state after the Administration IA and configuration correction slice, using the approved follow-up from `docs/administration-ia-configuration-handoff.md`.

Completed:

- Moved the admin facility page's list/create/update/delete operations behind `/api/admin/facilities` instead of direct browser Supabase mutations.
- Added a server-only facility service with `ADMIN_WORKSPACE` plus system-settings or attendance-management permission checks before reading or mutating facilities.
- Replaced broad `select('*')` facility reads with an explicit `id, facility_name, address, lat, lng, radius` contract.
- Kept Staff Attendance GPS matching on the existing shared `facilities` table source and did not introduce hardcoded workplace lists.
- Added focused static regression coverage for the server API boundary, permission checks, and explicit facility select list.

Database impact: none. No schema, RPC, RLS, storage, backfill, migration execution, production SQL, deployment, destructive operation, or live data mutation was performed. Active/inactive facility state remains a future schema-backed enhancement and still requires forward, rollback, validation, compatibility, security, and backfill artifacts before live approval.

Security impact: browser-side facility table mutations were removed from the admin facility page. Server authorization now checks `ADMIN_WORKSPACE` and either `SYSTEM_SETTINGS_*` or `ATTENDANCE_MANAGE` permissions before facility reads/mutations. Existing database RLS is unchanged.

Validation: targeted Vitest, `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check` to be recorded with final command results for this PR.

Next safe action: prepare an approved schema package for facility active/inactive state and stable facility codes, or continue the next approved roadmap feature that does not require live schema/RLS mutation.

## 2026-07-23 Facility active-state and stable-code schema package

Status: `LIVE_APPROVAL_REQUIRED` after safe artifact preparation. Continued the next approved facility follow-up after the Administration IA correction and facility server-boundary hardening.

Completed safe work:

- Prepared draft-only forward SQL for `public.facilities.code`, `public.facilities.is_active`, a unique facility-code index, and an active-facility partial index.
- Prepared rollback SQL that blocks rollback if inactive facility decisions would be lost.
- Prepared read-only validation SQL for column shape, populated/unique codes, active defaults, indexes, and absence of broad authenticated facility write policies.
- Prepared compatibility, security, and backfill artifacts documenting existing app compatibility, no browser-write policy expansion, duplicate-code review, and rollback/data-loss risks.
- Added focused static regression coverage proving the package remains draft-only and has the required forward, rollback, validation, compatibility, security, and backfill artifacts.

Database impact: no live SQL, migration promotion, RLS mutation, RPC deployment, storage change, backfill execution, facility live mutation, permission mutation, Auth mutation, destructive operation, production deployment, or production data mutation was performed.

Security impact: facility browser writes remain removed from the admin page; this package adds no grants, storage policy, Auth mutation, or broad browser write policy. The prepared validation checks for unsafe authenticated write policies before approval.

Current gate: `LIVE_APPROVAL_REQUIRED` before applying the facility active-state/stable-code package, promoting forward SQL into the Supabase GitHub Integration migration path, filtering inactive facilities in application code, or migrating employee branch mappings to stable facility codes.

## 2026-07-23 Facility active-state GitHub Integration delivery

Status: approved package delivered to the repository for the Supabase GitHub Integration workflow; stop after delivery per explicit operator instruction.

Approval scope: `LIVE_APPROVAL` was granted only for the reviewed facility active-state/stable-code package prepared on 2026-07-23. No application logic redesign, inactive-facility filtering, employee branch remapping, unrelated table change, additional schema change, or direct production SQL execution was performed.

Rollout evidence:

- Promoted only the reviewed forward SQL from `supabase/drafts/20260723_facility_status_code_forward.sql` to `supabase/migrations/20260723120000_facility_status_code.sql` for protected-main delivery through the configured Supabase GitHub Integration.
- Kept rollback and validation SQL outside `supabase/migrations/` at `supabase/drafts/20260723_facility_status_code_rollback.sql` and `supabase/drafts/20260723_facility_status_code_validation.sql`.
- No direct `psql`, `supabase db push`, `supabase db query`, live backfill, RLS mutation, permission mutation, Auth mutation, deployment, destructive operation, or production data mutation was executed from this environment.

Validation evidence:

- Static regression coverage now verifies migration parity with the reviewed forward SQL and confirms rollback/validation SQL were not promoted into the canonical migration.
- Required repository gates were run for this delivery: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`.
- Post-merge production validation remains the read-only SQL artifact `supabase/drafts/20260723_facility_status_code_validation.sql` after the Supabase GitHub Integration applies the migration.

Rollback evidence:

- Rollback remains the reviewed companion SQL `supabase/drafts/20260723_facility_status_code_rollback.sql` and blocks rollback if inactive facility rows exist so operational state is not silently lost.
- Rollback execution requires a separate approved live rollback decision after production state review.

Current stop condition: approved facility package delivered. Do not continue the next roadmap slice from this task.

## 2026-07-23 Repository guidance workflow refresh

Status: guidance update in progress for the current autonomous roadmap workflow.

Completed:

- Clarified that the Supabase GitHub Integration is the canonical production migration delivery path after a reviewed package is complete.
- Removed the need for a separate "Apply migration" task after forward SQL, rollback, validation, compatibility/backfill artifacts, documentation, tests, commit, and PR delivery are complete.
- Folded blocker, delivery, review, validation, documentation, and handoff preparation into the active implementation slice whenever possible.
- Clarified that safe application-only work should continue automatically until `LIVE_APPROVAL_REQUIRED`, production deployment, security approval, a real infrastructure blocker, validation failure, Git delivery blocker, or business decision stops progress.
- Reaffirmed that newly available actionable Code Review findings are inspected before the next roadmap slice and already-remediated findings classified as `FIXED`, `FALSE_POSITIVE_WITH_EVIDENCE`, or `NOT_APPLICABLE_WITH_EVIDENCE` are not reopened.
- Reaffirmed that Codex Cloud PostgreSQL TCP failures are expected environment limitations after confirmation, and direct TCP retries should stop in favor of Supabase GitHub Integration, Management API checks, CLI metadata, and read-only validation where available.

Validation: guidance regression coverage was added in `tests/repository-guidance-workflow.test.ts`; final command results are recorded in the delivery response.

Next safe action: after this guidance PR is created, continue the next approved roadmap feature from the latest protected-main state using the refreshed workflow.

## 2026-07-23 Facility active-state application gate preparation

Status: ✅ Application-only preparation complete; live enablement remains gated.

Scope completed:

- Staff Attendance now preserves the legacy facility select by default and adds a server-only `FACILITY_ACTIVE_STATE_ENABLED=true` gate for reading/filtering `facilities.is_active` after migration delivery and validation.
- Admin facility DTO/listing now preserves the legacy facility select by default and adds the same gate for including `facilities.code` and `facilities.is_active` after validation.
- Regression coverage records that inactive-facility filtering is not enabled unless the server-side gate is intentionally set.

Validation run:

- `npx vitest run tests/admin-ia-configuration-slice.test.ts tests/attendance-portal-regression.test.ts` PASS.

Database impact: none in this application slice. The reviewed forward migration remains under `supabase/migrations/20260723120000_facility_status_code.sql`; rollback and validation artifacts remain under `supabase/drafts/`.

Security impact: safer staged rollout because application reads do not request new columns until post-deployment validation allows a server-only gate. No browser Supabase mutation, RLS change, direct SQL, deployment, backfill, or production data mutation was performed.

Next step: after protected-main merge and Supabase GitHub Integration delivery, run `supabase/drafts/20260723_facility_status_code_validation.sql`; only if PASS, enable `FACILITY_ACTIVE_STATE_ENABLED=true` in the server runtime and verify Staff Attendance GPS matching excludes inactive facilities.

## 2026-07-23 Batch 3D2 system_settings broad-policy remediation package

Status: `LIVE_APPROVAL_REQUIRED` after safe artifact preparation. Continued the highest-priority unfinished roadmap item, Batch 3D2, without executing SQL or promoting an unapproved production migration.

Completed safe work:

- Prepared draft-only forward SQL to enable RLS defensively on `public.system_settings` and drop the legacy broad `Allow anon all` and `Allow authenticated all` policies.
- Prepared rollback SQL that intentionally restores the legacy broad policies only under a separate approved live rollback/security decision.
- Prepared read-only validation SQL that checks the broad policies are absent and RLS remains enabled.
- Prepared compatibility/backfill and security notes confirming Batch 3D1 removed runtime `system_settings` dependencies, no backfill is required, and no grants/service-role exposure/browser policy expansion is introduced.
- Added static regression coverage proving the package remains draft-only and includes forward, rollback, validation, compatibility/backfill, and security evidence.

Database impact: no live SQL, migration promotion, schema mutation beyond draft artifacts, RLS mutation, RPC deployment, backfill, production deployment, destructive operation, direct PostgreSQL TCP retry, or production data mutation was performed.

Security impact: this package is a security-hardening preparation step only. Runtime application paths already avoid `system_settings`; production policy removal remains gated until approved delivery through the Supabase GitHub Integration.

Current gate: `LIVE_APPROVAL_REQUIRED` before promoting the reviewed forward SQL into `supabase/migrations/` or applying the policy remediation in production.

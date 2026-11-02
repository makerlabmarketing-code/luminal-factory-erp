# QA-003 · Bảo vệ lịch sử trước khi mở luồng công việc

Trạng thái: **READY_FOR_REVIEW / LIVE_APPROVAL_REQUIRED**. Gói này chưa chạy
trên Production. Không đặt SQL vào `supabase/migrations/` trước khi được duyệt.

## Căn cứ hiện tại

Kiểm tra chỉ đọc ngày 02/11/2026 trên dự án ERP `kwfmfmpgpbfewpiizesv`:

- `task_comments`, `project_activity`, `phase_status_history`: mỗi bảng có
  **0 dòng**, RLS đang bật, một policy SELECT cho `authenticated` qua
  `can_view_project(project_id)`, không có trigger do ứng dụng tạo.
- Hai bảng đầu còn cấp toàn bộ quyền cho `anon` và `authenticated`; bảng
  `phase_status_history` chỉ cho `authenticated` SELECT. Cả ba sequence còn
  cấp quyền rộng cho trình duyệt. `service_role` có toàn bộ quyền trên ba bảng.
- Sự kiện hiện có gồm `PROJECT_CREATED` và các sự kiện Production Order.
  Gói tháng 7 thay danh sách sự kiện cũ không còn phù hợp để chạy lại.
- Commit cục bộ `96dc567` được sheet nhắc tới không tồn tại trong checkout
  hoặc GitHub. Đây là gói mới, dựng từ catalog hiện tại; không phải khôi phục
  hay xác nhận lại nguyên gói cũ.

## Thay đổi cần duyệt

| Phần | Sau khi áp gói |
| --- | --- |
| Ba bảng lịch sử nêu trên | Giữ nguyên cột, dữ liệu, check/FK, RLS và policy |
| `anon` | Không có quyền trên ba bảng hoặc sequence |
| `authenticated` | Chỉ SELECT qua RLS; không truy cập sequence |
| `service_role` | SELECT/INSERT; sequence USAGE/SELECT, không được `setval` |
| Trigger | Mỗi bảng thêm một trigger cấm UPDATE/DELETE và một trigger cấm TRUNCATE |
| Hàm trigger | `public.reject_project_history_mutation()`, invoker, search path cố định, không cấp EXECUTE cho các vai trò API |

Không tạo bảng/cột, không backfill, không sửa RPC tạo việc/chuyển trạng thái,
không ghi dữ liệu nghiệp vụ và không thay cờ tính năng. Forward giữ nguyên số
dòng. Preflight phải xác nhận không có bản ghi mồ côi hoặc chéo dự án.

**Tác động cần xác nhận:** khi có lịch sử, xóa cứng project/task/phase/employee
hoặc đối tượng liên quan có FK CASCADE/SET NULL có thể bị chặn để giữ lịch sử.
Hủy dự án và các cập nhật nghiệp vụ không đụng lịch sử vẫn dùng như hiện tại.
Tác động này được kiểm thử trong fixture; chưa thử trên bản ghi thật.

## Gói duy nhất và thứ tự thực hiện

1. Đọc `preflight.sql`; chạy bằng kết nối chỉ đọc, lưu count/grant/policy/FK.
2. Đối chiếu toàn bộ diff và SHA-256 của `forward.sql`. Duyệt đúng gói trước
   khi đưa vào đường triển khai migration đã chọn. Không chạy lại SQL tháng 7.
3. Sau khi được duyệt, dùng **một** đường triển khai: migration đã duyệt qua
   GitHub Integration hoặc Management API đã duyệt. Không dùng cả hai.
4. Chạy `validation.sql`, đối chiếu số dòng với preflight và kiểm tra grants,
   RLS, trigger, function, sequence. Dừng nếu có drift; forward có lock timeout
   5 giây, statement timeout 30 giây và guard trước DDL.
5. Nghiệm thu actor/quyền, bình luận, tạo việc và chuyển giai đoạn trên môi
   trường thử phù hợp. Không tạo fixture thay thế trong Production.
6. Duyệt riêng từng cờ `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED`,
   `TASK_COMMENTS_ACTIVITY_ENABLED`, `PHASE_WORKFLOW_FOUNDATION_ENABLED`,
   `PHASE_STATUS_MUTATION_ENABLED` sau khi các điều kiện tương ứng đạt.
   Các cờ khác và cấu hình hiện có giữ nguyên.

Gói này chỉ đóng phần **bảo vệ lịch sử** của QA-003. Nó không chứng nhận toàn
bộ nghiệm thu staff/manager/hai phiên và không tự cho phép bật các cờ trên.

## Kiểm thử lặp lại

SHA-256 của `forward.sql`:
`35b51c6b536b96d25cbf09d72644421fc5c562c0c89262ddbaf1c77f6162f43e`.

Fixture sử dụng PGlite 0.3.16 / PostgreSQL 17.5, cùng major 17 với Production
17.6. Bộ test local không thay thế postflight và nghiệm thu trên môi trường thật.

`npm test -- tests/qa003-history-hardening.test.ts`

PGlite chạy trong bộ nhớ, không nhận URL/credential và không gọi Production.
Fixture tải RPC từ migration thật của repo. Ma trận kiểm thử gồm:

- Tạo việc hợp lệ ghi task/comment/activity/notification trong cùng giao dịch;
  từ chối contributor, assignee vô hiệu hóa, phase/parent khác dự án và dự án hủy.
- Lỗi cưỡng bức ở comment/activity/notification không để lại dòng ghi dở.
- `anon`/`authenticated` không thể sửa, xóa, TRUNCATE hay tăng/đặt lại sequence;
  người có quyền chỉ đọc lịch sử đúng dự án qua RLS.
- Chủ bảng cũng bị trigger chặn sửa/xóa/TRUNCATE; FK cascade không xóa được
  lịch sử; chuyển phase hợp lệ vẫn ghi audit, trạng thái cũ bị từ chối.
- Số dòng, định nghĩa RPC và check sự kiện hiện tại được giữ nguyên;
  guard chặn chạy lại/drift; rollback giữ dữ liệu và quyền trình duyệt đã siết.

## Rollback

`rollback.sql` cần duyệt riêng. Nó bỏ đúng sáu trigger và hàm của gói, không
xóa dữ liệu và **giữ nguyên quyền đã siết/RLS**. Không tự cấp lại quyền rộng cho
trình duyệt. Đây là rollback guard, không khôi phục byte-for-byte ACL cũ.
Trước rollback cần tắt những cờ đã bật cho luồng chịu ảnh hưởng theo phạm vi duyệt.

# ERP Attendance · Ca cũ chưa checkout không khóa ca mới

**Trạng thái:** `RPC_PRODUCTION_APPLIED_AND_VALIDATED`, **`RUNTIME_FLAG_APPROVAL_REQUIRED`**. Hàm Production đã thay đổi, nhưng màn Staff vẫn khóa ca cũ cho tới khi bật cờ và QA đăng nhập. Ngày chuẩn Việt Nam (Asia/Ho_Chi_Minh).

## Tình huống đã tái hiện từ giao diện

- Staff Attendance ngày 16/11/2026 hiển thị ca chưa checkout ngày 12/11/2026 lúc 16:13.
- API hiện kiểm tra `attendance` không giới hạn `work_date` và từ chối mọi check-in khi tìm được một bản ghi chưa checkout.
- RPC `public.staff_attendance_multi_mutation(text)` (nếu bật) cũng từ chối check-in khi **bất kỳ** ca nào chưa checkout và có thể checkout bản ghi lịch sử bằng giờ của ngày hiện tại, vì vậy không được gỡ chặn UI đơn thuần.

## Quy tắc được đề xuất

1. Ca chưa checkout từ **ngày trước** là khoản cần đối soát, **không** được coi là ca đang làm hôm nay; **không** ghi giờ ra tự động, không tính công/lương, không xóa ca đó.
2. Nếu người dùng chưa có ca đang mở hôm nay và đang ở đúng vị trí GPS: được bắt đầu ca mới với timestamp do server cấp, chỉ khi được bật flag sau khi database đã sẵn sàng.
3. Nếu có ca đang mở **hôm nay**, chỉ kết thúc ca hôm nay (RPC khóa theo nhân viên, dòng theo ngày); một ca cũ chưa checkout không được chọn để kết thúc.
4. Client hiển thị đồng thời banner **ca cũ cần bổ sung giờ ra** và trạng thái ca đang làm hôm nay; có thể thao tác chấm công hiện tại.
5. Quản lý giải quyết ca cũ qua nghiệp vụ điều chỉnh chấm công đã có, nhập giờ ra thật và lý do; kiểm tra quyền `ATTENDANCE_MANAGE`, lịch sử, kỳ lương đã chốt và hiệu lực RPC. Không tạo dữ liệu giả.
6. Khi chưa bật flag, **không thay đổi** hành vi khóa cũ. Không làm vòng tránh bypass RPC/RLS.

## Đường dẫn implementation

- `lib/attendanceManualMutationGate.ts`: `ATTENDANCE_STALE_ISOLATION_ENABLED` server-only, bắt buộc đồng thời `ATTENDANCE_MULTI_CHECK_ENABLED=true`.
- `app/api/staff/attendance/route.ts`: GET tách ca hôm nay khỏi ca cũ; POST kiểm tra đúng ca hôm nay khi gate bật. Giữ kiểm tra GPS và ID từ phiên đăng nhập.
- `app/staff/attendance/AttendanceView.tsx`: banner ca cũ tồn tại độc lập với nút ca hôm nay, thông báo rõ chưa tính công.
- `supabase/drafts/attendance-stale-isolation/forward.sql`: chỉ CREATE OR REPLACE chính hàm Staff RPC để hai điều kiện open check-in/out đều có `work_date = p_work_date`. Giữ permission, advisory lock, audit và **quy tắc lương hiện hành từ migration `20260811022500_attendance_credited_hours_payroll.sql`** (`credited_shifts × 3h`), tuyệt đối không lấy lại RPC cũ tính lương theo giờ thực; không schema/migration/backfill.
- `preflight.sql`, `validation.sql`, `rollback.sql`: do operator review và giữ bằng chứng riêng, **không chạy từ repo**.

## Thực tế Production · 16/11/2026

- Người dùng đã duyệt riêng việc cập nhật **Staff RPC** trong cuộc trò chuyện.
- Supabase ERP `kwfmfmpgpbfewpiizesv`: migration version `20261116060231`, tên `attendance_stale_isolation_staff_rpc_date_scoped_20261116`, chạy qua công cụ migration Production và trả về `success`.
- Tiền kiểm so sánh toàn bộ nội dung hàm `prosrc` đang chạy với SQL migration `20260811022500_attendance_credited_hours_payroll.sql`: **trùng chính xác**, không có khác biệt ngoài hai điều kiện được duyệt.
- Hậu kiểm `prosrc`: 2 điều kiện `work_date = p_work_date`, 0 điều kiện all-date còn sót, hash mới `2ce8584a221609624cfa331488d190e2`. `SECURITY INVOKER` và ACL `postgres/authenticated/service_role` không đổi; `pg_advisory_xact_lock(actor)`, `credited_hours := credited_shifts * 3` được giữ.
- Dữ liệu đối soát trước/sau vẫn là **1 ca trước ngày hiện tại chưa checkout, 0 ca hôm nay đang mở**; không có bản ghi, công/lương hay quyền truy cập nào được cập nhật.
- Vercel: `ATTENDANCE_MULTI_CHECK_ENABLED=true`, `ATTENDANCE_MANUAL_MUTATIONS_ENABLED=true`. `ATTENDANCE_STALE_ISOLATION_ENABLED` **chưa có biến cấu hình**, mặc định OFF. Vercel commit `379b28f` READY. CI cùng commit có 1.085 Vitest PASS, TypeScript/ESLint và browser QA đạt.
- Migration đã được ghi nhận trong **lịch sử Supabase remote**, nhưng không tự thêm vào `supabase/migrations/` để tránh tích hợp GitHub chạy lặp; **cần đối soát lịch sử remote/local trước khi triển khai migration tiếp theo**. Source được giữ tại `supabase/drafts/attendance-stale-isolation/forward.sql`, rollback tương ứng bên cạnh.

## Các bước còn lại trước khi mở chức năng

1. **Chờ duyệt riêng** cho phép thêm Vercel Production `ATTENDANCE_STALE_ISOLATION_ENABLED=true` và redeploy. Hai cờ nền multi-check và manual-mutation đang bật, nhưng phải xác minh lại trước khi đổi.
2. Sau khi bật, dùng phiên Staff thực tế xác nhận: có ca cũ còn mở nhưng vẫn check-in hôm nay bằng GPS; checkout **chỉ** ca hôm nay; cảnh báo ca cũ còn hiển thị; không tính công/lương cho ca cũ chưa hoàn tất.
3. Dùng phiên quản lý độc lập kiểm tra phân quyền và việc bổ sung giờ ra thực tế kèm lý do; không tự sửa giờ hoặc thử với dữ liệu chấm công thật khi chưa được phép.
4. Kiểm tra trùng check-in / thao tác đồng thời, kỳ lương đã chốt, quyền truy cập, và ca bắt qua nửa đêm (chưa có chính sách overnight được duyệt).
5. Chỉ đóng QA-ATT-STALE/E-024 khi có bằng chứng người dùng đã đăng nhập kiểm thử thành công. Browser guest và CI xanh không thay thế nghiệm thu thực tế.

## Rollback

Tắt flag trước, sau đó operator dùng `rollback.sql` theo gate duyệt để khôi phục logic date-global. Kể cả sau rollback, **không được xóa** dữ liệu ca hôm nay hoặc ca cũ; sự kiện đã ghi phải được bảo toàn. Nếu sau khi bật đã có nhiều ca mở hợp lệ khác ngày, rollback sẽ khóa ca mới khi chưa có đối soát, vì vậy cần preflight runtime trước rollback.

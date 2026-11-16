# ERP Attendance · Ca cũ chưa checkout không khóa ca mới

**Trạng thái:** APPLICATION_READY_FOR_CI, **LIVE_APPROVAL_REQUIRED** trước khi áp function database hoặc bật runtime. Ngày chuẩn Việt Nam (Asia/Ho_Chi_Minh).

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

## Production activation gate

1. Đối chiếu **trực tiếp** `pg_get_functiondef(public.staff_attendance_multi_mutation(text))` với bản `forward.sql` trước khi áp; dừng nếu khác ngoài 2 date predicates. Xác nhận `ATTENDANCE_MULTI_CHECK_ENABLED` và `ATTENDANCE_MANUAL_MUTATIONS_ENABLED` hiện hành trên Vercel mà không đọc secret.
2. Kiểm tra Supabase schema, index `attendance_employee_date_shift_active_idx`, quyền Staff và `ATTENDANCE_MANAGE` Admin; kiểm tra kỳ lương, không chỉnh dữ liệu cũ.
3. Operator áp gói SQL **sau khi người dùng phê duyệt riêng**, theo kênh kiểm soát Production; lưu bằng chứng xác thực + rollback.
4. Chạy `validation.sql`, sau đó mới đặt `ATTENDANCE_STALE_ISOLATION_ENABLED=true` ở Vercel (được phê duyệt riêng) và redeploy. Không bật nếu `ATTENDANCE_MULTI_CHECK_ENABLED=false`.
5. Thử với dữ liệu có kiểm soát: (a) ca cũ chưa checkout + hôm nay chưa check-in; (b) hôm nay đang làm + ca cũ; (c) checkout hôm nay không sửa ca cũ; (d) check-in đồng thời không tạo trùng; (e) ca cũ không tính công/lương; (f) Manager điều chỉnh ca cũ + lý do; (g) nhánh chốt lương và phân quyền.
6. Giữ `QA-ATT-STALE` chờ nghiệm thu 2 tài khoản độc lập. Không tự checkout hoặc sửa dữ liệu trong Production bằng fixture tùy tiện.

## Rollback

Tắt flag trước, sau đó operator dùng `rollback.sql` theo gate duyệt để khôi phục logic date-global. Kể cả sau rollback, **không được xóa** dữ liệu ca hôm nay hoặc ca cũ; sự kiện đã ghi phải được bảo toàn. Nếu sau khi bật đã có nhiều ca mở hợp lệ khác ngày, rollback sẽ khóa ca mới khi chưa có đối soát, vì vậy cần preflight runtime trước rollback.

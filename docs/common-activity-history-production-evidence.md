# E-009 — kích hoạt lịch sử hoạt động Production

Owner duyệt ngày 09/10/2026: sheet Điều phối, E-009, Quyết định = Cho phép; hội thoại xác nhận đã duyệt.

## Triển khai

- Đích ERP Supabase `kwfmfmpgpbfewpiizesv`.
- Preflight: bảng/RPC mới chưa tồn tại; schema employees/financial_ledger và signature/definition RPC đối ứng khớp gói đã kiểm tra.
- Áp dụng nguyên forward trong giao dịch bằng Supabase migration API: `20261009064809_erp_common_activity_history`.
- Bật biến server `ERP_ACTIVITY_HISTORY_ENABLED=true` cho Vercel Production, không bật Preview/Development.
- Không chỉnh sửa bản ghi nghiệp vụ thật để tạo lịch sử mẫu; không backfill.

## Kiểm tra

- Bộ SQL PGlite 0.5.8 đạt: audit text che dữ liệu riêng tư, actor tin cậy, bỏ qua no-op, sửa PAID giữ trạng thái/ngày trả, bảo vệ người hưởng/người trả của hoàn ứng, browser bị từ chối, lỗi audit hoàn tác nghiệp vụ, rollback giữ lịch sử.
- Postflight live: RLS bật; anon/authenticated không SELECT/INSERT/UPDATE/DELETE kho audit và không gọi RPC; service_role có SELECT/INSERT/EXECUTE, không UPDATE/DELETE audit. Hai trigger enabled; PK và hai index hiện diện; kho mới có 0 sự kiện tại thời điểm kiểm tra.
- RPC SECURITY INVOKER; trigger SECURITY DEFINER với search_path rỗng và không được browser gọi trực tiếp.
- Security Advisor: không cảnh báo mới cho hai hàm. INFO RLS/no-policy trên kho audit là chủ đích default-deny, đã đối chiếu quyền browser bị thu hồi. Các WARN thuộc các hàm/Auth đã có, không thay đổi trong slice này.
- Mã ứng dụng ac1646c: 924 tests, lint, typecheck, build đã đạt trước khi bật cấu hình. Kiểm tra UI sau deploy và bằng chứng deployment cập nhật trong sheet E-009.
- Giao dịch chỉnh sửa có ghi thực trên Production chưa được smoke bằng dữ liệu thật; kiểm tra nguyên tử/PAID thực hiện ở database tạm.
- Production `3eaf4eb`, deployment `dpl_3B8C5twa6qtLESKJPJ98kzGJtefn` READY: tab lịch sử nhân sự và hộp lịch sử giao dịch tải được, hiển thị kho trống. Khoản hoàn ứng PAID kỳ 09/2026 có nút Điều chỉnh; người hưởng/người thực hiện/loại và trạng thái thanh toán bị khóa. Thiếu lý do bị chặn ngay ở form (5–500 ký tự), không gửi chỉnh sửa thật. Dòng mô tả chờ SQL cũ được thay bằng nội dung theo gate đang bật.

## Dung lượng và phạm vi

### Sửa tên tham chiếu trong lịch sử ngày 09/10/2026

- Owner báo lịch sử hiển thị `Dự án: null → 9`. Read-only Production xác nhận sự kiện #1, giao dịch #115, dự án #9 có tên `Meowhe 1`.
- Service đọc lịch sử lấy tên hiện tại từ `projects.project_name` và `employees.full_name` cho cả giá trị trước/sau của trường chọn dự án, người thực hiện, người hưởng lợi, người chi trả. Hiển thị tên kèm ID để phân biệt tên trùng; `null` thành `Chưa chọn`; bản ghi đã xóa giữ ID và ghi rõ không còn trong danh sách.
- Giữ nguyên audit text trong database, quyền FINANCE_VIEW/EMPLOYEE_VIEW, phân trang 50 dòng, che dữ liệu riêng tư nhân sự và nguyên văn lý do. Tên là tên hiện tại, không phải ảnh chụp tên tại thời điểm thao tác. Không backfill hoặc sửa dữ liệu thật.
- Kiểm thử hồi quy bao gồm tên trùng, tham chiếu đã xóa, cả hai phía thay đổi và lý do nhiều dòng giống cú pháp audit. Rollback bằng revert thay đổi service/helper; không cần rollback SQL.

Ghi ID/thời điểm/người thao tác/entity/thao tác/màn/tóm tắt và text thay đổi tối đa 8 KiB. Không lưu snapshot, file hoặc giá trị riêng tư hồ sơ. Link dựng từ ID khi đọc. Hồ sơ nhân sự và sổ thu chi có lịch sử; các phân hệ khác chưa được ghi vào kho này.

## Rollback

Tắt ERP_ACTIVITY_HISTORY_ENABLED và deploy trước. Nếu cần dừng capture, dùng rollback đã chuẩn bị tại supabase/drafts/common-activity-history/rollback.sql. Kho và các sự kiện giữ nguyên; không tự hoàn tác các chỉnh sửa nghiệp vụ đã được lưu hợp lệ. Không chạy lại forward trên Production.

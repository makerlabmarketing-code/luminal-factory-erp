# Bảng công việc và đồng bộ trực tiếp

Luminal Factory đã xác minh dùng Supabase Free. Giữ nguyên gói, giới hạn mặc định và ngân sách phát sinh 0 USD. Không tạo dịch vụ hoặc dự án trả phí. Nếu hết hạn mức hoặc mất kết nối, người dùng tiếp tục dùng nút Làm mới bảng. Bản đầu không dùng Presence và không polling nền. Một màn hình chỉ đăng ký dự án đang xem ở chế độ Bảng.

Kênh Broadcast riêng dùng chính sách đọc theo quyền dự án. Trình duyệt không có chính sách gửi. Trigger phát tín hiệu trong cùng giao dịch với thay đổi trạng thái trên bảng công việc. Tín hiệu không chứa nội dung công việc. Không backfill hoặc thay đổi bản ghi hiện có. API có quyền hiện hành quyết định dữ liệu mỗi người nhận được. Giữ `NEXT_PUBLIC_TASK_BOARD_REALTIME_FREE` tắt cho đến khi áp và kiểm tra SQL trên môi trường thử. Không bật các cờ giao việc Production chỉ để thử bảng.

Nghiệm thu trên Free gồm hai tài khoản ở hai phiên riêng, nhận tín hiệu sau khi lưu, không nhận khi ngoài dự án, từ chối ghi từ cột cũ, tái kết nối tải lại và làm mới thủ công khi kênh không khả dụng. Rollback bằng cách tắt cờ client và áp rollback.sql. Không xóa dữ liệu công việc hoặc lịch sử.

Workflow Task board realtime acceptance dùng Supabase Docker cục bộ và tài khoản thử trên GitHub Actions. Kiểm tra hai phiên WebSocket, chặn người ngoài dự án, bỏ qua giao dịch rollback hoặc cập nhật không đổi trạng thái, và kiểm tra rollback SQL. Bài kiểm tra dùng dữ liệu và hàm phân quyền mẫu, không thay cho nghiệm thu hai phiên trình duyệt ERP.

## Production · 13/11/2026

Gói SQL #276 đã được duyệt và áp qua Supabase Migration API khi GitHub Integration báo `MIGRATIONS_FAILED`. Bản ghi `20261113080659_erp_task_board_realtime` dùng đúng nội dung đã duyệt. SHA-256: `b98010dc8f18a3464a9672e6ee5104ee511403a638152866777fa82fc26106c8`.

Đã xác minh chính sách SELECT chỉ cho vai trò authenticated, trigger khi status đổi và quyền EXECUTE bị chặn với anon/authenticated. Không có backfill. Giữ Supabase Free. Cờ realtime và giao việc Production chưa bật. ERP Production chưa có công việc liên kết dự án để nghiệm thu bằng hai phiên. Bài kiểm thử hai phiên đã đạt trên Supabase cục bộ.

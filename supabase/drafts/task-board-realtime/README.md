# Bảng công việc và đồng bộ trực tiếp

Luminal Factory đã xác minh dùng Supabase Free. Giữ nguyên gói, giới hạn mặc định và ngân sách phát sinh 0 USD. Không tạo dịch vụ hoặc dự án trả phí. Nếu hết hạn mức hoặc mất kết nối, người dùng tiếp tục dùng nút Làm mới bảng. Bản đầu không dùng Presence và không polling nền. Một màn hình chỉ đăng ký dự án đang xem ở chế độ Bảng.

Kênh Broadcast riêng dùng chính sách đọc theo quyền dự án. Trình duyệt không có chính sách gửi. Trigger chỉ gửi tín hiệu rỗng khi lịch sử ghi nhận một lần đổi trạng thái. API có quyền hiện hành quyết định dữ liệu mỗi người nhận được. Giữ `NEXT_PUBLIC_TASK_BOARD_REALTIME_FREE` tắt cho đến khi áp và kiểm tra SQL trên môi trường thử. Không bật các cờ giao việc Production chỉ để thử bảng.

Nghiệm thu trên Free gồm hai tài khoản ở hai phiên riêng, nhận tín hiệu sau khi lưu, không nhận khi ngoài dự án, từ chối ghi từ cột cũ, tái kết nối tải lại và làm mới thủ công khi kênh không khả dụng. Rollback bằng cách tắt cờ client và áp rollback.sql. Không xóa dữ liệu công việc hoặc lịch sử.

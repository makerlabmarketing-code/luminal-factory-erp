# Tiền cá nhân chờ hoàn

Bản đầu tiên áp dụng cho phiếu lương liên kết, gồm lương gốc và khoản bổ sung. Khi xác nhận từ mã QR hoặc từ trạng thái phiếu, chủ hệ thống chọn Quỹ chung hoặc một thành viên góp vốn đang hoạt động. Nguồn cá nhân và xác nhận thanh toán được ghi trong cùng giao dịch. Thông báo lương vẫn dùng luồng gửi hiện tại sau khi ghi sổ thành công.

Phiếu lương đã trả cho phép sửa nguồn trước lần hoàn đầu tiên. Lịch sử lưu thay đổi nguồn. Dòng đối ứng và phiếu hoàn liên kết với phiếu gốc bằng ID. Phiếu hoàn dùng mã yêu cầu duy nhất, khóa phiếu gốc và kiểm tra số dư trước khi ghi. Admin thực hiện chuyển khoản ngoài ERP và xác nhận sau khi chuyển. Kỳ hoàn lấy theo ngày xác nhận tại Việt Nam. Hoàn từng phần tạo từng dòng thu chi, giảm quỹ và số còn phải hoàn. Báo cáo chi phí chỉ tính khoản chi gốc.

Thẻ Tiền cá nhân chờ hoàn cộng các phiếu đã liên kết qua tất cả các kỳ. Các dòng đối ứng cũ và chi phí ngoài lương chưa được chuyển vào thẻ mới. Cần đối chiếu phiếu chi, người ứng và lịch sử đã hoàn trước khi nhập số dư đầu kỳ. Gói này không có lệnh chuyển dữ liệu cũ hoặc cập nhật phiếu lương thật.

## Kiểm tra và triển khai

- Chạy `PGLITE_MODULE=/path/to/pglite/dist/index.js node supabase/drafts/personal-advances/test.mjs`. Bài kiểm thử chạy SQL thật trên schema giả lập và mô phỏng hàm xác nhận lương đang dùng.
- Sau khi được duyệt triển khai SQL, chạy kiểm tra khả năng tương thích trên schema đích, chuyển bản forward đã duyệt vào thư mục migration và thực hiện qua quy trình phát hành của repo.
- Bật `FINANCE_PERSONAL_ADVANCES_ENABLED=true` sau khi xác minh SQL, báo cáo và tài khoản có quyền. Cờ mặc định tắt.
- Khi cần dừng chức năng ghi, tắt cờ. Nếu đã phát sinh giao dịch, giữ schema và logic đọc báo cáo mới. Rollback SQL tự chặn xóa khi có lịch sử tiền ứng hoặc hoàn.

# Nguồn chi cá nhân của Hà và Duy

Kiểm tra chỉ đọc trên ERP ghi nhận cả hai người có cấu hình góp vốn tháng. Danh mục nguồn chi chỉ có hai bản ghi mẫu, đều chưa hoạt động, và chưa có phiếu lương liên kết với tiền ứng cá nhân. Luồng ghi nhận hiện tại nhận ID từ danh mục nguồn chi và chỉ chấp nhận trạng thái ACTIVE.

Gói dữ liệu đăng ký hai nguồn chi theo tên đã đối chiếu với cấu hình góp vốn. Hai trường số của bản ghi mới được đặt bằng 0 để không ghi nhận tỷ lệ sở hữu hoặc số vốn góp. Giữ nguyên các bản ghi mẫu, số tiền góp hàng tháng, số dư quỹ, lịch sử thanh toán và phân quyền.

Sau khi được duyệt cập nhật Production, ghi lại ID hiện có của hai tên đích, áp dụng forward qua quy trình phát hành đã được duyệt và chạy validation. Ghi lại ID mới để rollback chỉ vô hiệu hóa đúng các nguồn vừa tạo. Vô hiệu hóa nguồn vẫn giữ lịch sử và liên kết khoản ứng đã phát sinh. Kiểm tra giao diện bằng tài khoản có quyền quản trị nguồn chi.

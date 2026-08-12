# Bàn giao hiệu ứng xuất hiện khi cuộn ở chi tiết dự án

## Phạm vi

- Thêm component dùng chung `ScrollReveal` dựa trên `IntersectionObserver`.
- Chỉ áp dụng cho hai nhóm nội dung chính bên dưới màn hình đầu tiên: thành viên dự án và khu vực thực thi công việc.
- Không thay đổi API, hợp đồng dữ liệu, quyền truy cập, migration hoặc runtime flag.

## Nguyên tắc chuyển động

- Chỉ chuyển `opacity` và `transform` trong 250 ms với đường cong `ease-out`.
- Observer tự ngắt sau lần xuất hiện đầu tiên; không đăng ký sự kiện `scroll`.
- Độ trễ được giới hạn tối đa 120 ms; trang chi tiết hiện dùng 0 ms và 40 ms.
- Nội dung hiển thị bình thường khi `prefers-reduced-motion: reduce`, khi không có `IntersectionObserver`, hoặc trước khi JavaScript tăng cường giao diện.

## Kiểm tra và hoàn tác

- Kiểm thử tĩnh nằm tại `tests/scroll-reveal-foundation.test.ts`.
- Để hoàn tác riêng lát cắt này, bỏ hai wrapper `ScrollReveal` khỏi trang chi tiết dự án rồi xóa component và kiểm thử tương ứng. Không cần thao tác cơ sở dữ liệu.

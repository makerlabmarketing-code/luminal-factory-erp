# Bàn giao hiệu ứng xuất hiện khi cuộn cho màn hình vận hành

## Trạng thái

`APPLICATION_COMPLETE` — không cần thao tác cơ sở dữ liệu hoặc bật cờ tính năng.

## Phạm vi

- Giữ nguyên hai nhóm hiệu ứng ở Chi tiết dự án.
- Thêm hai nhóm ở Dashboard: chỉ số tổng hợp và khu vực biểu đồ.
- Thêm hai nhóm ở Điều phối dự án: chỉ số dự án và khu vực bảng/dòng sản phẩm.
- Không tạo hiệu ứng riêng cho từng thẻ, dòng bảng, colorway, modal hoặc nút.

## Hành vi và khả năng tiếp cận

- Dùng component chung `ScrollReveal` với `IntersectionObserver` một lần cho mỗi nhóm.
- Chỉ thay đổi `opacity` và `transform` trong 250 ms; độ trễ lớn nhất đang dùng là 40 ms.
- Observer tự ngắt sau lần xuất hiện đầu tiên và không nghe sự kiện `scroll`.
- Nội dung hiển thị ngay khi người dùng bật giảm chuyển động, trình duyệt không hỗ trợ observer hoặc JavaScript chưa tăng cường giao diện.
- Không thay đổi thứ tự đọc, khả năng dùng bàn phím, API, dữ liệu, quyền truy cập hoặc trạng thái tải/lỗi/rỗng.

## Kiểm tra và hoàn tác

- Kiểm thử tĩnh: `tests/scroll-reveal-foundation.test.ts`.
- Hoàn tác riêng lát cắt này bằng cách bỏ các wrapper `ScrollReveal` trong `AdminDashboardCharts.tsx` và `app/admin/projects/page.tsx`; không cần hoàn tác dữ liệu.
- Component chung và hai wrapper ở Chi tiết dự án thuộc PR #171, không cần xóa khi chỉ hoàn tác phần mở rộng này.

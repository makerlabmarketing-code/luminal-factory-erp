# Quy tắc quy đổi công ca từ 2026-09-08

## Phạm vi đã duyệt

Quy đổi công ca từ tổng thời gian thực tế của từng bản ghi chấm công đã có đủ giờ vào và giờ ra:

- dưới 30 phút: 0 công ca
- từ 30 phút đến 3 giờ 29 phút: 1 công ca
- từ 3 giờ 30 phút đến 6 giờ 29 phút: 2 công ca
- từ 6 giờ 30 phút trở lên: 3 công ca

Giới hạn tối đa vẫn là 3 công ca cho một bản ghi. Giờ thực tế tiếp tục được giữ nguyên để đối chiếu; lương quy đổi dùng 3 giờ cho mỗi công ca.

## Chủ sở hữu quy tắc

- Giao diện và tổng hợp ứng dụng: `services/attendanceService.ts`
- Ghi nhận lương khi tạo/cập nhật chấm công: trigger PostgreSQL trong gói SQL đi kèm
- Quyết toán lương: `public.payroll_month_calculation`

## Tác động dữ liệu

- Không thay đổi giờ vào, giờ ra hoặc `total_hours` lịch sử.
- Không sửa các bản quyết toán lương bất biến đã chốt.
- Không backfill `total_salary` lịch sử; bảng lương chưa chốt được tính lại từ `total_hours` theo công thức mới.
- Các lần checkout hoặc chỉnh sửa chấm công sau khi rollout sẽ lưu `total_salary` theo quy tắc mới.

## Kiểm tra biên

Các mốc bắt buộc: `0→0`, `29→0`, `30→1`, `209→1`, `210→2`, `389→2`, `390→3` và thời lượng lớn hơn vẫn tối đa 3.

## Rollback

Rollback bỏ trigger và hàm quy đổi mới, sau đó khôi phục `public.payroll_month_calculation` về công thức `1..180→1`, `181..360→2`, `>360→3`. Không có dữ liệu nào bị xóa. Các bản quyết toán đã chốt trong thời gian áp dụng quy tắc mới vẫn bất biến.

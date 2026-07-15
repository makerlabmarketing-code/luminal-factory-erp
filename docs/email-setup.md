# Email Setup

SMTP hiện được đọc từ biến môi trường server, không đọc từ bảng cấu hình runtime.

## Biến môi trường bắt buộc

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

## Biến môi trường tùy chọn

- `SMTP_FROM_NAME`
  Giá trị gợi ý: `Luminal HQ`

## Lưu ý với Gmail SMTP

Giá trị đúng thường là:

- `SMTP_HOST = smtp.gmail.com`
- `SMTP_PORT = 465`
  Dùng SSL/TLS trực tiếp

Hoặc:

- `SMTP_HOST = smtp.gmail.com`
- `SMTP_PORT = 587`
  Dùng STARTTLS

Nếu đang để `456` thì gần như sẽ không gửi được.

## Cách lấy App Password của Gmail

1. Đăng nhập tài khoản Gmail dùng để gửi mail.
2. Vào `Google Account`.
3. Bật `2-Step Verification`.
4. Tìm `App passwords`.
5. Tạo app password mới cho mục Mail.
6. Copy chuỗi 16 ký tự và lưu vào `SMTP_PASS` trong Vercel/server environment.

## Cách test từ màn Email Template

1. Vào `Mẫu Email Template`.
2. Chọn một template.
3. Bấm nút gửi thử.
4. Nhập email nhận test.

Nếu gửi thành công, hệ thống sẽ ghi vào `email_history`.

## Template group cần có để chạy cron

- `CAPITAL_CALL`
  Dùng cho route `/api/cron/monthly-payroll`

- `ATTENDANCE_CHECKOUT_REMINDER`
  Dùng cho route `/api/cron/attendance-checkout-reminder`

## Biến nội dung có thể dùng trong template

- `{{hoTen}}`
- `{{customer_name}}`
- `{{employee_name}}`
- `{{shift_name}}`
- `{{work_date}}`
- `{{order_id}}`
- `{{amount}}`

Ngoài ra hệ thống vẫn hỗ trợ cú pháp cũ dạng `[hoTen]`, `[customer_name]`...

## Supabase Auth URL Configuration

Production app base URL:

- `https://erp.luminalfactory.com`

Redirect URL cần có trong Supabase Auth URL Configuration:

- `https://erp.luminalfactory.com/auth/callback`
- `https://erp.luminalfactory.com/auth/update-password`

Luồng chuẩn nên đặt `redirectTo` về callback:

- Invite user: `https://erp.luminalfactory.com/auth/callback`
- Reset password: `https://erp.luminalfactory.com/auth/callback`

`/auth/update-password` vẫn nên nằm trong allow-list để tương thích link cũ và các template đang trỏ trực tiếp, nhưng route tạo session chuẩn là `/auth/callback`.

Email template Supabase nên phân biệt:

- Invite user: link mời dùng callback, type `invite` hoặc payload implicit invite của Supabase.
- Reset password: link đặt lại dùng callback, type `recovery`.

Không đưa access token hoặc refresh token vào query string mới trong template tùy chỉnh.

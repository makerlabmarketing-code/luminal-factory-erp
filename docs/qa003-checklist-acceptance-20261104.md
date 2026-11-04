# QA-003 / E-011 — nghiệm thu sau bảo vệ lịch sử

Ngày 04/11/2026. Phạm vi: tiếp tục roadmap checklist; không đổi dữ liệu nghiệp
vụ, permission, SQL hoặc cờ Production.

## Đối chiếu thực tế

- #248 đã merge tại `2ce0141`; migration `20261102061722` có trong ledger.
- #249 đã merge tại `788932f`; migration `20261102065026` có trong ledger.
- Cả ba bảng task_comments, project_activity, phase_status_history đang bật RLS
  và mỗi bảng có hai trigger ứng dụng. Ghi nhận “chưa áp SQL/thiếu guard” trong
  bảng điều phối trước lượt này đã lỗi thời.
- Đây là đối chiếu chỉ đọc. Không suy ra cờ đã bật chỉ từ migration hoặc build.

## Phần nghiệm thu được bổ sung

Đưa runner PostgreSQL tạo dự án/checklist/mẫu hiện có vào Vitest để CI thực sự
chạy nó. Bổ sung tám ca chạy RPC thật trong PGlite dùng bộ SQL của repository:

1. Thu hồi thành viên dự án chặn ghi.
2. Người khác không sửa việc được giao cho nhân viên.
3. Nhân viên bị vô hiệu hóa không ghi được.
4. Dự án lưu trữ không nhận cập nhật.
5. Hai snapshot cũ: lần lưu sau bị từ chối, không thêm lịch sử/ghi chú hoặc đổi hạn.
6. Nhân viên không sửa hạn thì giữ hạn mới do quản lý đã đặt.
7. Hạn vượt hạn dự án bị từ chối và không ghi dở.
8. Đổi người làm giữa lúc đọc/lưu làm mất hiệu lực quyền của người cũ.

Runner cũng giữ các ca tạo dự án, liên kết chặng/task, kế thừa phân công,
nhân viên không tự duyệt, snapshot mẫu không sao chép người/ngày/kết quả,
áp mẫu, lỗi xuất bản và rollback giữ dữ liệu.

Tất cả fixture dùng database trong bộ nhớ, không dùng URL/credential Production.
Hai snapshot là mô phỏng stale write, không phải hai phiên trình duyệt hay hai
kết nối Postgres đồng thời. Bộ guard lịch sử và hồi quy permission vẫn chạy
trong các suite riêng; không coi đây là xác nhận toàn bộ rollout.

## Còn lại trước đóng E-011

Kiểm tra cục bộ ngày 04/11: 1.031 tests / 147 files, ESLint và TypeScript đạt;
production webpack build đạt với cấu hình Supabase public giả chỉ dành cho build.
Focused run: 18 Vitest tests ở ba suite, gồm runner tám ca checklist mới,
16 ca hardening và runner 23 assertion permission. `git diff --check` đạt.
Lần build đầu thiếu public publishable placeholder; chạy lại với đúng ba biến
public giả đã đạt. Không đọc hoặc thay secret/cấu hình Production.

- Nghiệm thu giao diện tạo/lưu/tải lại với fixture được duyệt trên môi trường
  thử phù hợp; staff/manager/hai phiên trình duyệt; luồng duyệt và trả sửa.
- Xác nhận cấu hình thực tế và duyệt riêng cờ còn cần bật. Không bật cờ vì lượt
  này đạt test cục bộ, không tự gán nhân sự hay tạo dự án thử trên Production.
- Giữ E-011 ở Chờ kiểm thử; phần bảo vệ lịch sử đã triển khai, không xin duyệt
  lại cùng gói SQL.

Rollback phần việc này: bỏ wrapper Vitest và tám fixture mới, trả tài liệu về
phiên bản trước. Không có migration hoặc dữ liệu Production cần rollback.

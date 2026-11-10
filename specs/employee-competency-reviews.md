# E-022 — Đánh giá năng lực và gửi kết quả cho nhân viên

Ngày 10/11/2026. **Bản triển khai chờ duyệt SQL production**.

## Yêu cầu và quyết định cần chốt

Owner yêu cầu quản lý nhân sự chấm đánh giá, có nút Gửi kết quả; Staff Portal
hiển thị kết quả đã gửi và bảng tính điểm để nhân viên hiểu cách đánh giá.
Mã ERP hiện chưa có module này. Nguồn tham khảo đã đọc đủ 3 trang:
`Luminal_Nhom_viec_va_Review_Nhan_su.pdf`, Library version 2, nội dung v3.0
ngày 31/10/2026. PDF ghi rõ khung đề xuất, chưa phải chính sách đã chốt.

Tiếp tục theo bốn tiêu chí 0–2 bên dưới. Mức lương trong tài liệu tham khảo nằm ngoài phạm vi. Gói SQL chờ duyệt riêng trước khi áp dụng.

## Màn hình và luồng đề xuất

**Quản trị → Nhân sự → Đánh giá năng lực**: danh sách theo kỳ/nhân viên, trạng thái
Nháp / Đã gửi; mở từ hồ sơ nhân sự với người được chọn sẵn. Quản lý chọn nhóm việc
đã giao/hướng dẫn, chấm điểm, ghi ví dụ, điểm mạnh, việc cần cải thiện và mục tiêu.
Có Lưu nháp, Xem trước bản nhân viên và **Gửi kết quả**. Lưu không đồng nghĩa gửi.

Gửi mở hộp xác nhận tên người nhận, kỳ, tổng điểm hoặc thiếu dữ liệu và nội dung
công bố. Sau khi server lưu thành công mới báo Đã gửi. Retry không tạo hai bản.
Đóng băng thang điểm, nội dung, người gửi và thời điểm gửi thành snapshot.

**Staff Portal → Đánh giá năng lực**: luôn đọc được bảng giải thích thang điểm;
chưa có kết quả thì ghi “Chưa có kết quả đánh giá được gửi”. Khi có kết quả, hiển thị
kỳ, người chấm, ngày gửi, từng điểm, tổng/công thức, bằng chứng, nhận xét và mục tiêu.
Chỉ nhận bản đã gửi của chính nhân viên; không tải draft rồi ẩn bằng CSS.
Có nhãn Chưa xem/Đã xem; Đã xem không có nghĩa đồng ý với kết luận.

PDF còn có tự đánh giá. Giữ hai cột tự chấm/quản lý độc lập, không tự lấy trung bình;
quản lý không sửa điểm tự chấm thay nhân viên, staff không sửa điểm quản lý.
Không thêm email/SMTP hoặc tự gửi khi quản lý nhập đủ điểm.

## Bảng điểm dùng chung hai màn hình

| Tiêu chí | 0 điểm | 1 điểm | 2 điểm |
| --- | --- | --- | --- |
| Chất lượng | Lỗi thao tác lặp lại, phải sửa nhiều | Đạt sau khi được nhắc hoặc sửa | Đạt ngay, ổn định theo mẫu chuẩn |
| Năng suất | Chậm hơn mốc đã thống nhất | Đạt mốc nhưng cần hỗ trợ | Tự đạt mốc, vẫn giữ chất lượng |
| Tự chủ | Cần kèm từng bước | Tự làm việc quen, cần nhắc | Tự chuẩn bị, kiểm tra, bàn giao |
| Phối hợp | Lỡ lịch/bàn giao thiếu, không báo | Có lúc cần nhắc báo và bàn giao | Giữ lịch, chủ động báo, bàn giao đủ |

Mỗi ô: 0 / 1 / 2 / Chưa đánh giá; không chọn sẵn 0. Chưa giao, chưa hướng dẫn hoặc
thiếu dữ liệu ghi Chưa đánh giá và lý do. Chỉ cộng /8 khi đủ bốn điểm; thiếu thì ghi
“Chưa đủ dữ liệu · n/4 tiêu chí”, không chuẩn hóa mẫu số hoặc quy thành 0.
Có thể gửi nhận xét chưa đủ điểm với kết luận thiếu dữ liệu rõ ràng, không xếp bậc.
Ví dụ hiển thị: 2 + 1 + 2 + 2 = 7/8. Không tự xếp hạng nhân viên.

Điểm quản lý cần bằng chứng. So công việc cùng độ khó, loại trừ lỗi máy/file/vật liệu.
Chưa thống nhất mốc năng suất thì thu dữ liệu, không cho 0 theo cảm tính.
Nhóm A: In 3D/xử lý mẫu; B: Khuôn/casting/hậu kỳ; C: Đóng gói; D: Tìm model (giao riêng).
A+ chỉnh file/gắn support chỉ xét khi đã đào tạo/giao việc, không tự cộng điểm/thưởng.

Không đổi lương trong bản đầu. Các mức 30k/33k/35k/38k của PDF chỉ minh họa chưa duyệt;
không ghi hourly_rate, tính lại payroll hoặc tạo phiếu/email lương từ thao tác đánh giá.
Chính sách quy đổi/ngày hiệu lực nếu cần sẽ được chốt riêng.

## Hợp đồng dữ liệu và quyền dự kiến

Tách kỳ, bản làm việc theo employee ID, phần tự đánh giá, snapshot công bố và audit.
Mỗi kỳ/nhân viên có một bản làm việc hiện hành; lưu/gửi kiểm tra expected revision.
Snapshot giữ rubric version, điểm/lý do/bằng chứng/nhận xét, actor và thời gian.
Đổi rubric kỳ sau không đổi điểm kỳ trước. Không dùng tên/email làm khóa người nhận.

Đề xuất quyền xem, chấm và gửi riêng; giữ Admin workspace và phạm vi nhân sự ở
server/database. Không tự cấp cho mọi Admin hoặc suy ra quyền từ chức danh/menu.
Xác định nhóm quản lý và phạm vi nhân sự trước khi cấp quyền. Staff ID lấy từ session
đã xác minh; không tin ID do client chọn. Không thay quyền Thu chi/Payroll/Account.

RLS/API phải chặn staff đọc draft/bản người khác và sửa/gửi điểm quản lý. RPC gửi
kiểm tra quyền/revision/nội dung, ghi snapshot/audit/trạng thái/thông báo cùng transaction.
Không nhận published_by từ payload, không dùng service key trong client.
Đã gửi không sửa âm thầm hoặc xóa cứng; hiệu chỉnh tạo nháp mới có lý do, gửi lại
mới thay bản hiện hành, giữ lịch sử cho người nhận. DTO staff chỉ có nội dung công bố.

## Thực thi, kiểm thử và cổng duyệt

1. Chốt rubric; chuẩn bị model tính điểm, DTO/validation, component dùng chung,
   admin form và mục staff. Nếu thiếu schema phải fail closed, không giả lưu bằng localStorage.
2. Chuẩn bị gói SQL draft/rollback/preflight/validation và RLS; SQL chưa duyệt không
   đặt trong migrations, không backfill kết quả hoặc cấp quyền hàng loạt.
3. Test 0/8/7 điểm, thiếu khác 0, điểm ngoài 0–2, tự chấm độc lập, rubric snapshot,
   stale revision, retry/double send, transaction rollback và hiệu chỉnh bất biến.
4. Test staff A không đọc draft/bản B qua list/detail/API/count; anon/inactive/ngoài
   phạm vi HR và reviewer không có quyền gửi đều bị chặn.
5. Browser dữ liệu thử: quản lý lưu/reload → staff chưa thấy → gửi/reload → đúng staff
   thấy điểm/công thức/rubric → người khác không thấy; hai phiên, mobile và tablet.
6. Test/lint/TypeScript/build, rà review; trình gói SQL cụ thể trước triển khai live.

Hoàn thành khi luồng lưu nháp → gửi → staff xem và quyền âm tính được kiểm chứng,
không thay lương. Merge đặc tả không có nghĩa đã triển khai tính năng.
Rollback sau công bố phải bảo toàn snapshot/audit, dừng ghi và sửa tiến nếu cần;
không xóa lịch sử đánh giá để rollback.

## Phạm vi bản đầu

Owner có thể chấm và gửi. Cấp quyền quản lý theo phạm vi nhân sự là bước riêng. Staff xem bản đã gửi của chính mình và có thể đánh dấu đã xem. Bản đã gửi lưu thang điểm đầy đủ, người gửi, điểm tự chấm tại lúc gửi và lý do hiệu chỉnh. Bản gửi mới xuất hiện trong mục Kết quả đã gửi với trạng thái Chưa xem.

Cờ `COMPETENCY_REVIEWS_ENABLED` mặc định tắt. [SQL](../supabase/drafts/competency-reviews/forward.sql), [kiểm tra trước](../supabase/drafts/competency-reviews/preflight.sql), [kiểm tra sau](../supabase/drafts/competency-reviews/validation.sql) và [rollback](../supabase/drafts/competency-reviews/rollback.sql). Tắt cờ để dừng sử dụng, giữ toàn bộ lịch sử sau khi đã có dữ liệu.

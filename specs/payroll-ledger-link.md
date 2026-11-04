# E-012 — Nối quyết toán lương với Sổ thu chi

Ngày: 04/11/2026. Trạng thái: **DRAFT_FOR_REVIEW**.

Đây là đặc tả và kế hoạch kiểm thử, chưa phải gói SQL sẵn sàng triển khai.
Không thay đổi ứng dụng, migration, cờ, quyền, lương, phiếu thu chi hoặc email.
Các phương án dưới đây cần được chốt trước khi viết migration tài chính.

## Mục tiêu và phạm vi

Sau khi chốt một bản lương, người quản lý thấy đúng một phiếu lương liên kết
trong Sổ thu chi, kể cả khi số tiền bằng 0. Chốt lương ghi nhận nghĩa vụ;
**không tự xác nhận đã trả và không gửi email đã thanh toán**.
Người quản lý không phải nhập lại nhân viên, tháng hoặc số tiền.

Giữ nguyên bản chốt và điều chỉnh bất biến, quy trình mở lại kỳ chưa trả,
quyền nhân viên xem lương của mình và bước xác nhận thanh toán riêng.
Không tự nối, sửa hay xoá phiếu lương cũ theo tên nhân viên hoặc mô tả.
Không mở rộng quyền Sổ thu chi khi bổ sung liên kết.

## Hiện trạng đã đối chiếu trong source

| Thành phần | Chủ sở hữu và hành vi hiện tại |
| --- | --- |
| Chốt lương | `services/server/payroll.ts` gọi `settle_monthly_payroll(bigint,date)`; trả `settlementId`. RPC trong migration mở lại lương ghi snapshot và audit, chưa ghi ledger. |
| Bản chốt hiệu lực | `payroll_active_settlements` trỏ tới một snapshot cho mỗi nhân viên/tháng; mở lại giữ snapshot cũ và bỏ con trỏ hiệu lực. |
| Tổng phải trả | `payroll_result` trong `supabase/drafts/payroll-adjusted-reopen/forward.sql` cộng điều chỉnh của cả nhân viên/tháng, kể cả điều chỉnh thuộc snapshot trước. Không chỉ cộng điều chỉnh trên snapshot mới. |
| Điều chỉnh | `create_payroll_adjustment` tạo dòng bất biến riêng; không sửa `base_salary` của snapshot. |
| Phiếu nguồn | Migration Ledger/Reimbursement có `source_type`, `source_reference`, uniqueness cặp nguồn, beneficiary ID và `cancelled_at`. Cần kiểm tra lại catalog live trước khi lập DDL. |
| Trạng thái trả tiền | Hợp đồng ledger hiện dùng `UNPAID`/`PAID`; không tự thêm trạng thái thứ ba vào cột chung. |
| Xác nhận lương đã trả | `confirm_salary_ledger_payment` và `services/server/salaryPaymentEmail.ts`; snapshot email yêu cầu số tiền dương. Không dùng đường này cho 0đ. |
| Tương thích mở lại | Các guard hiện có chặn snapshot cũ, kỳ đã trả và email theo nhân viên/tháng. Gói mới phải giữ chúng. |

Đây là bằng chứng source ở `155fda3`, không phải một lần nghiệm thu dữ liệu live mới.
Audit 19/10 là lịch sử; các đề xuất 0đ bên dưới thay thế khuyến nghị cũ về bỏ phiếu 0đ
ở mức phương án thiết kế, chưa thay thế hành vi Production.

## Phương án đề xuất

1. Trong **cùng giao dịch PostgreSQL**, chốt snapshot, tạo phiếu nguồn và audit.
   Nếu bất kỳ bước nào lỗi, không giữ lại một phần. Không tạo phiếu bằng một
   request thứ hai sau khi chốt hoặc từ `useEffect` ở giao diện.
2. Dùng `source_type='PAYROLL'`, `source_reference=settlementId::text`,
   `beneficiary_employee_id` lấy từ snapshot và `month_period` từ tháng chuẩn hoá.
   Dự kiến phiếu `CHI_PHI`, nhóm Lương; phải đối chiếu quy tắc vốn/đối ứng hiện có
   trước khi chốt mapping. Không suy ra payer hoặc người thực trả từ người chốt.
3. Tạo bảng liên kết dự kiến `payroll_ledger_links`: FK snapshot UUID và ledger ID,
   unique từng phía, trạng thái liên kết `ACTIVE`/`SUPERSEDED`, audit actor/thời điểm.
   Đây là metadata nghĩa vụ, không phải sổ tiền thứ hai. Khoản phải trả vẫn là
   kết quả payroll; tiền đã chi vẫn là ledger được xác nhận trả.
4. Phiếu dương bắt đầu chưa trả. Phiếu 0đ vẫn hiện trong sổ, có nhãn dẫn xuất
   **Không phát sinh thanh toán**, không QR/nút Đã trả/email; `is_paid=false`,
   `paid_at=null`. Danh sách khoản cần trả phải loại trường hợp này dựa trên
   liên kết hiệu lực và amount=0, không đổi nghĩa mọi phiếu `UNPAID` khác.
5. Không tự biến tổng âm thành 0 hoặc tạo khoản thu/thu hồi lương. Chặn giao dịch
   tích hợp với thông báo cần đối soát và không lưu một phần; chính sách thu hồi
   hoặc chuyển kỳ là quyết định nghiệp vụ riêng trước khi hỗ trợ tổng âm.
6. Giữ RPC chốt hiện tại trả UUID và lỗi chốt trùng `409`. Hai request chốt đồng
   thời chỉ tạo một snapshot hiệu lực và một phiếu. Không coi retry sau mở lại
   là chốt thành công bản cũ: dùng snapshot ID để kiểm tra phiên bản.
7. Điều chỉnh khi chưa trả phải đồng bộ số phải trả trong cùng giao dịch điều chỉnh,
   với audit trước/sau; gồm chuyển 0→dương và dương→0. Không tạo phiếu thứ hai.
   Điều chỉnh sau khi đã trả cần phương án đối soát riêng; không tự sửa phiếu
   hoặc email đã trả và không âm thầm đổi quyền điều chỉnh hiện có.
8. Mở lại khi chưa trả phải vô hiệu hoá liên kết và huỷ mềm phiếu nguồn cũ trong
   cùng giao dịch bỏ snapshot hiệu lực. Giữ lịch sử và lý do. Chốt lại tạo snapshot
   và phiếu mới; điều chỉnh cũ vẫn chỉ được tính một lần. Không xoá vật lý.
9. Nút Đã trả chỉ áp dụng phiếu dương liên kết hiệu lực. Server lấy đúng employee,
   tháng, số tiền; không tin tháng/số tiền gửi từ trình duyệt. Thanh toán cạnh tranh
   với điều chỉnh hoặc mở lại phải khoá và kiểm tra cùng trạng thái hiệu lực.
10. Không cho sửa tay amount/beneficiary/month/source hoặc huỷ phục hồi phiếu nguồn
    qua endpoint ledger chung. Điều chỉnh đi từ Payroll; mở lại đi từ quy trình
    được bảo vệ. Phiếu thủ công cũ tiếp tục đi theo hợp đồng hiện tại.

## Tác động kỹ thuật và quyền

- Quyền chốt/mở lại vẫn là `PAYROLL_SETTLE`, điều chỉnh là `PAYROLL_ADJUST` và
  truy cập Admin workspace. Không phát sinh quyền xem finance cho người chốt lương.
- Chọn rõ boundary thực thi sau preflight: giữ RPC dùng phiên xác thực hoặc một
  server-only entrypoint có actor đã xác minh. Không thêm bypass quyền hoặc cấp
  EXECUTE cho anon/PUBLIC để việc ghi ledger hoạt động.
- Bảng liên kết mới phải có RLS, grant/policy tối thiểu; nhân viên không được
  đọc hoặc sửa phiếu của người khác. Không thêm service key vào frontend.
- Tất cả đường chốt/điều chỉnh/mở lại/trả tiền phải dùng cùng thứ tự khoá đã kiểm
  chứng. Đối chiếu các trigger dùng advisory lock `payroll-reopen-salary-payment`
  và row lock hiện tại trước khi chọn thứ tự; không chỉ khoá ở một RPC mới.
- Rà mọi đường ghi ledger chung, import, huỷ/khôi phục và nguồn đối ứng để không
  thay đổi phiếu payroll ngoài quy trình. Cả DB và server phải kiểm soát.
- Tiền dùng numeric và quy tắc làm tròn đang có trong payroll, không tính lại bằng
  JavaScript. Không dùng tên nhân viên làm khoá và không nhân đôi adjustment.
- Trước DDL cần kiểm tra constraint amount, source uniqueness, type/category,
  RLS/grants, trigger lịch sử, FK, paid flags và các RPC thực tế. Không giả định
  schema live giống một fixture rút gọn.

## Tương thích dữ liệu cũ

Không backfill mặc định. Preflight chỉ đọc lập danh sách snapshot hiệu lực chưa
liên kết và phiếu SALARY/PAYROLL/manual cùng nhân viên/tháng. Khoản đã trả, đã có
email hoặc nhiều phiếu ứng viên là trường hợp đối soát; không tự tạo thêm khoản
phải trả. Backfill chỉ có sau duyệt danh sách exact IDs, số tiền và quan hệ phụ thuộc.
Nếu phát hiện phiếu nguồn trùng hoặc orphan, dừng; không dùng ON CONFLICT để bỏ qua
sai lệch tiền/người/tháng.

## Ma trận nghiệm thu bắt buộc cho gói triển khai

| Ca | Kết quả phải chứng minh bằng fixture |
| --- | --- |
| Chốt lương dương | 1 snapshot hiệu lực + 1 phiếu chưa trả, đúng người/tháng/tổng; 0 email. |
| Chốt lương 0đ | 1 phiếu hiển thị, không nút trả/QR/email, không làm tăng tổng tiền đã chi. |
| Tổng âm | Bị chặn để đối soát; không còn snapshot/phiếu/audit một phần. |
| Lỗi ghi ledger/audit | Rollback cả snapshot và con trỏ hiệu lực. |
| Retry và hai kết nối chốt | Chỉ một cặp snapshot/phiếu; request thua không ghi thêm. |
| Điều chỉnh chưa trả | Amount khớp `final_payable_amount`; 0↔dương đúng; adjustment bất biến. |
| Mở lại/chốt lại hai lần | Phiếu cũ bị huỷ mềm, liên kết cũ superseded, không tính adjustment hai lần. |
| Mở lại đua trả tiền | Chỉ một kết quả hợp lệ; không trả phiếu stale hoặc mở kỳ đã trả. |
| Điều chỉnh đua trả tiền | Email/phiếu chụp đúng tổng đã xác nhận; không stale amount hoặc double pay. |
| Sửa/huỷ/khôi phục qua API chung | Không bypass nguồn payroll kể cả actor có FINANCE_UPDATE. |
| Legacy và backfill | Không tự gắn tên/tháng, không tạo trùng phiếu đã trả; exact-ID gate. |
| Phân quyền | Staff/anon/actor thiếu quyền bị chặn; người không có FINANCE_VIEW không thấy ledger. |
| Tiền và tháng | Làm tròn như payroll, chuẩn tháng; đóng/reopen không đổi tổng do client tính lại. |
| Xem lại/tổng hợp | Phiếu huỷ/0đ không hiện thành khoản đã chi hoặc khoản còn phải trả dương. |

Hai kết nối PostgreSQL thật và hai phiên UI là nghiệm thu riêng; không gọi hai
snapshot đọc tuần tự hoặc mock RPC là kiểm thử đồng thời thật.

## Kế hoạch bàn giao và rollback

1. Chốt phương án 0đ, tổng âm, phiếu sau điều chỉnh, quyền actor và mapping
   type/category. Kiểm tra catalog và dependency hiện tại chỉ đọc.
2. Sau khi phương án được duyệt: xây gói draft đủ forward, rollback, preflight,
   validation, fixture, tương thích, guard nguồn và application wiring mặc định tắt.
3. Test migration/rollback trên dữ liệu rỗng và đã có phiếu, forced failure,
   hai kết nối và UI; giữ bằng chứng riêng cho từng lớp. Chỉ sau đó mới có gói
   SQL cụ thể để owner duyệt; chưa đặt DDL vào `supabase/migrations/` ở bước này.
4. Triển khai qua protected-main/Supabase Integration sau duyệt gói, không trực tiếp
   chạy DDL hoặc tạo kỳ lương/phiếu/email thật để thử.
5. Rollback đặc tả này chỉ hoàn tác tài liệu. Với triển khai tương lai: tắt kích
   hoạt, giữ phiếu/links/audit đã tạo, dừng chức năng ghi tích hợp nếu không thể
   giữ bất biến. Không DROP dữ liệu đã phát sinh; ưu tiên forward-fix hoặc thao tác
   huỷ có audit đã được duyệt. Không âm thầm quay lại chốt không tạo phiếu sau khi
   hợp đồng mới đã áp dụng cho các kỳ lương.

## Kiểm tra đã chạy ở bước đặc tả

49 tests / 5 suites hiện có về payroll, bản chốt bất biến, mở lại và email lương
đạt trên checkout `155fda3`. Đây là kiểm tra hành vi hiện có, **không phải** bằng
chứng tính năng nối ledger, các ca mới ở trên hoặc giao dịch Production đã chạy.

# Bảng chung và lịch sử hoạt động ERP — E009

## Trạng thái và phạm vi

Bảng chung áp dụng cho 16 màn có bảng HTML; dữ liệu, bộ lọc, phân trang và kiểm tra quyền vẫn thuộc từng màn. `TableRowActions` nhận callback JSX do màn khai báo; tối đa hai thao tác hiện trực tiếp, nhiều hơn thì giữ thao tác đầu và đưa phần còn lại vào `…`. Menu dùng portal tránh bị cắt bởi vùng cuộn, hỗ trợ Escape, đóng khi click/focus ra ngoài. Không có phụ thuộc mới.

Lịch sử mới dành cho hồ sơ nhân sự và sổ thu chi. Hồ sơ nhân sự hiển thị thay đổi của hồ sơ đó và hoạt động thu chi do nhân sự thực hiện nếu người xem có quyền tài chính. Các phân hệ khác chưa được ghi vào kho này. Không tạo lại lịch sử quá khứ.

`ERP_ACTIVITY_HISTORY_ENABLED` mặc định tắt. Có thể triển khai bảng chung và mã ứng dụng trước; chức năng điều chỉnh hoàn ứng đã trả và kho lịch sử chỉ bật sau khi SQL được duyệt, áp dụng và kiểm tra.

## Gói duyệt sản xuất

Đích: ERP Supabase `kwfmfmpgpbfewpiizesv`, không phải Commerce.

1. Chạy `preflight.sql` chỉ đọc, so sánh schema thực tế và RPC đối ứng hiện có. Dừng nếu đối tượng mới đã tồn tại hoặc contract thay đổi.
2. Sau khi chủ hệ thống duyệt, áp dụng nguyên `forward.sql` trong một giao dịch. File nằm ở `drafts/`, không tự áp dụng qua thư mục migrations.
3. Chạy `validation.sql` chỉ đọc; xác nhận RLS, quyền, hai trigger và index. Kiểm tra Security Advisor đối với trigger definer bên dưới.
4. Bật biến **server** `ERP_ACTIVITY_HISTORY_ENABLED=true`, triển khai lại ERP rồi kiểm tra màn hồ sơ/thu chi. Không dùng biến NEXT_PUBLIC. Không tự sửa bản ghi thực để làm mẫu.
5. Nếu có sự cố, tắt biến và triển khai lại trước khi chạy `rollback.sql`. Giữ nguyên kho lịch sử và các dòng đã ghi.

## Contract và nguyên tử

RPC service-only `update_erp_record_with_history` nhận entity/id/patch/actor/reason. Server xác minh tài khoản và quyền EMPLOYEE_MANAGE hoặc FINANCE_UPDATE, lấy actor từ phiên đã xác thực; không tin actor từ trình duyệt. RPC khóa dòng, chỉ nhận danh sách cột được phép, cập nhật dữ liệu và trigger ghi lịch sử trong cùng giao dịch. Lỗi audit hủy toàn bộ thay đổi; không fallback sang ghi không có audit. Đối ứng vốn tiếp tục đi qua RPC nguyên tử đang có.

Giao dịch đã trả bắt buộc lý do 5–500 ký tự; giữ loại giao dịch, trạng thái và thời điểm trả. Hoàn ứng PAID cho sửa khoản mục, số tiền, kỳ, ngày giao dịch, mô tả và dự án; không đổi người hưởng/người trả/người yêu cầu hoặc mở lại workflow. Sửa chứng từ đính kèm hiện nằm ngoài RPC này, không lưu bản sao file trong nhật ký.

Trigger chỉ gắn lên employees và financial_ledger. `SECURITY DEFINER` chỉ dùng cho hàm trigger với search_path rỗng, tên bảng cố định, trường chọn sẵn, không quyền gọi trực tiếp cho public/anon/authenticated; cần để ghi audit sau các đường ghi cũ mà không mở quyền kho audit cho trình duyệt. RPC cập nhật là SECURITY INVOKER. Browser roles không đọc/ghi/gọi; service_role được select/insert, không update/delete audit.

Các đường ghi cũ không có actor context vẫn được trigger bắt thay đổi và hiển thị “Hệ thống / không xác định người thao tác”; không suy đoán người trả là người thao tác. Sửa hồ sơ và sửa sổ qua RPC mới có actor xác thực. Chưa chuyển toàn bộ đường tạo/xóa/thay đổi quyền thành RPC có actor.

## Dung lượng, dữ liệu riêng tư và tương thích

Mỗi sự kiện gồm ID, giờ, actor ID, entity/record ID, thao tác, màn hình, tóm tắt và text thay đổi tối đa 8 KiB. Không lưu JSON snapshot, ảnh/chứng từ, access token hay thông tin đăng nhập. Trường hồ sơ nhạy cảm chỉ ghi tên trường “đã thay đổi”, không sao chép giá trị ngân hàng, điện thoại, email hay lương. Dữ liệu tài chính chọn sẵn lưu trước/sau; mô tả dài chỉ ghi đã thay đổi. Link dựng ở ứng dụng, không tốn một URL lưu lặp cho mỗi dòng. Hai index hỗ trợ lịch sử bản ghi/người thao tác; tải 50 dòng/lần. Dung lượng thực tế phụ thuộc độ dài text và index; không hứa một số byte cố định.

Không backfill: không có nguồn chứng minh lịch sử cũ. Không tự xóa theo thời hạn; cần quyết định lưu trữ riêng trước khi áp dụng retention. Schema thêm mới, không đổi cột/quyền bảng nghiệp vụ/RPC cũ. Rollback không hoàn tác các chỉnh sửa nghiệp vụ hợp lệ và không xóa audit. Nếu tắt gate, các đường cũ tiếp tục hoạt động; trigger vẫn ghi cho tới khi rollback.

## Kiểm thử

Ứng dụng: npm test, npm run lint, npx tsc --noEmit, npm run build và git diff --check.

SQL được chạy trong PGlite 0.5.8 ở bộ nhớ, không kết nối Supabase:

```sh
NODE_PATH=/tmp/luminal-product-sql/node_modules ERP_SQL_TEST=DISPOSABLE_LOCAL_DATABASE node scripts/verify-common-activity-history.cjs
```

Để tái chạy ở máy khác, cài riêng @electric-sql/pglite@0.5.8 trong thư mục tạm và trỏ NODE_PATH tới node_modules đó. Fixture dựa trên schema/RPC ERP đã đọc trực tiếp; kiểm tra actor, no-op, CREATE/DELETE, che giá trị riêng tư, paid correction, trường được bảo vệ, browser denied, audit failure rollback và rollback giữ lịch sử. Kiểm thử tạm không thay thế postflight sản xuất.

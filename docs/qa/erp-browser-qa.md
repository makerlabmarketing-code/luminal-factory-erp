# Luminal ERP · Browser QA (QA-004)

## Mục tiêu và ranh giới

Có hai chế độ riêng biệt để không phát sinh chi phí API AI hoặc ghi nhầm dữ liệu thật.

1. **Tự động sau mỗi commit main:** GitHub Actions chạy đầy đủ Vitest, ESLint, TypeScript (sau `next typegen`), đợi commit có trạng thái Vercel = success, sau đó dùng Playwright kiểm tra các trang ERP ở chế độ khách trên desktop, tablet và mobile. Nếu lỗi, job riêng ghi nhận link lần chạy tại [QA-004](https://github.com/makerlabmarketing-code/luminal-factory-erp/issues/280). Nếu lỗi, job riêng ghi nhận link lần chạy tại [QA-004](https://github.com/makerlabmarketing-code/luminal-factory-erp/issues/280).
2. **Codex repo trusted / AI tương tác trên máy đã đăng nhập:** Codex CLI + agent-browser MCP khám phá giao diện, thao tác tab/menu/bảng/panel, ghi các bước tái hiện và hình chụp tại máy cục bộ; Codex có thể sửa code sau khi đọc nguyên nhân và chạy regression. Không tự đẩy sửa đổi production dữ liệu/quyền/lương.

Repository ERP hiện **public**. Runner tiêu chuẩn GitHub Actions trên repo public miễn phí; workflow này **không tải artifact lên GitHub**, không sử dụng AI API, không tạo tài nguyên cloud trả phí. Nếu chuyển repo sang private, phải rà lại chính sách phí trước khi bật lại. Codex ChatGPT sign-in dành cho phiên sử dụng cục bộ; không chạy Codex unattended qua API trên Actions.

## Các file đã tích hợp

- `.github/workflows/erp-browser-qa.yml`: chạy khi push `main` hoặc `workflow_dispatch`, cài dependency từ `package-lock.json` bằng `npm ci --ignore-scripts`, chạy Vitest, ESLint, TypeScript, chờ Vercel READY rồi chạy browser smoke. Job báo lỗi có `issues: write` riêng, không nằm trong job duyệt trang. Node's `node:test` contract file has the `.node.mjs` suffix so Vitest does not collect it as a second test framework. The payroll SSR regression now expects the selection toolbar, not inline row actions. Build Production do Vercel chịu trách nhiệm.
- `scripts/qa/erp-browser-smoke.mjs`: kiểm tra đường dẫn /login, /admin/capital, /admin/projects, /admin/employees, /admin/payroll, /staff/tasks.
- `scripts/qa/erp-browser-contract.node.mjs`: sáu ca kiểm thử offline, gồm 503, lỗi login gate, overflow ngang, bảo vệ origin và không cho lưu phiên đăng nhập lên runner public.
- `scripts/qa/setup-agent-browser.ps1`: cài agent-browser 0.43.0 và đăng ký MCP `luminal-agent-browser` cho Codex trên máy Windows.

Browser chạy bốn viewport `1440×900`, `1024×768`, `768×1024` và `390×844`, chỉ cho phép yêu cầu GET/HEAD/OPTIONS (trừ refresh token nếu chạy riêng tại máy), không bấm nút lưu, chuyển tiền, gửi lương, duyệt, xóa. Ở chế độ khách, tất cả route quản trị phải hiển thị form đăng nhập đầy đủ hoặc trả 401/403; trang login không được tràn ngang trên bất kỳ viewport nào. Kết quả trên Chromium viewport giả lập **không thay thế** nghiệm thu Safari/iPad thật. Trạng thái code xanh **không đồng nghĩa** với QA Owner/Staff đã hoàn tất.

## Tự đăng ký agent-browser trong Codex qua GitHub (không cần máy Windows)

- File `.codex/config.toml` đăng ký MCP `luminal-agent-browser` theo **repo**; khi Codex chạy ở môi trường tin cậy và đọc project config, Codex tự khởi chạy `scripts/qa/bootstrap-agent-browser-mcp.sh`. Script dùng `npx` lấy phiên bản `agent-browser@0.43.0`, chuẩn bị Chrome (lần đầu) và chạy MCP stdio, không cần đăng ký thủ công trên máy cá nhân.
- Repo cấp cấu hình công cụ, **không cấp quyền đăng nhập ChatGPT/ERP** và không ép được ứng dụng ChatGPT hiện tại nhận MCP mới. Codex Cloud cần mở repo này trong môi trường có `bash`, `node/npm/npx`, internet để tải gói và quyền thực thi; project phải ở trạng thái trusted.
- Domain được giới hạn vào `erp.luminalfactory.com` và hostname Supabase của ERP; thao tác eval/download cần xác nhận. Không cấu hình API key, không cung cấp cookie, không thiết lập quyền ghi tài chính tự động.
- Workflow GitHub Actions kiểm tra việc khởi động server MCP, phát hiện tool open/snapshot và thực sự mở `/login` ở chế độ khách. Kết quả kiểm thử đăng nhập Owner/Staff vẫn là bước khác, chỉ thực hiện khi có môi trường xác thực an toàn.
- Các file: `.codex/config.toml`, `scripts/qa/bootstrap-agent-browser-mcp.sh`, `scripts/qa/verify-project-mcp.mjs`. Script Windows `setup-agent-browser.ps1` vẫn là **tùy chọn** khi sau này muốn chạy local.

## Cài agent-browser trên Windows (máy cá nhân)

Đọc file cài trước khi chạy, sau đó mở PowerShell từ thư mục repo:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/qa/setup-agent-browser.ps1
codex login
```

Nếu thích cài thủ công:

```bash
npm install -g agent-browser@0.43.0
agent-browser install
agent-browser skills get core
codex mcp add luminal-agent-browser -- agent-browser mcp
codex login
```

Đăng nhập Codex bằng tài khoản ChatGPT trong trình duyệt, không paste token vào code hoặc issue. Sau đó giao Codex: **“Đọc docs/qa/erp-browser-qa.md, kiểm thử read-only ERP theo QA-004, dùng MCP luminal-agent-browser; ghi bug có bước tái hiện, không thực hiện mutation tài chính.”**

Có thể chạy CLI thủ công sau khi đọc hướng dẫn của đúng phiên bản:

```bash
agent-browser --session luminal-qa --allowed-domains erp.luminalfactory.com open https://erp.luminalfactory.com/admin/capital
agent-browser --session luminal-qa snapshot -i
agent-browser --session luminal-qa console
agent-browser --session luminal-qa errors
```

Người dùng tự đăng nhập trong phiên local; **không** đưa cookie, session storage, HAR hoặc screenshot tài chính lên repo public, GitHub Issue public hay workflow logs.

## Checklist tương tác ở bản đã đăng nhập

- Kiểm tra tài khoản Owner: điều hướng, tab theo bàn phím, menu overflow, table loading/empty/error, panel focus/Escape, responsive.
- Tại Sổ thu chi, chọn một dòng: xác nhận toolbar chỉ hiện thao tác phù hợp. Chọn hai dòng: không được có bulk xác nhận thu/trả, duyệt, gửi email. Bỏ chọn, đổi kỳ, tìm kiếm và sang trang: checkbox phải reset.
- Chỉ mở/đóng panel Thêm giao dịch, tuyệt đối không click Ghi sổ.
- Đăng xuất và kiểm tra lại bằng **tài khoản Staff độc lập**. Không dùng một phiên Owner làm bằng chứng Staff.
- Với từng lỗi: ghi vai trò, viewport, route (không chứa query/token), bước tái hiện, kỳ vọng/thực tế, loại lỗi console, và tham chiếu ảnh đã làm sạch dữ liệu cá nhân. Tạo/cập nhật QA-004, không đăng ảnh nhạy cảm.
- Codex có thể sửa giao diện và bổ sung test; thay đổi SQL, permission, payroll, email, finance, tự động merge/production mutation cần giữ cổng duyệt riêng.

## Chạy Playwright cục bộ (không thêm dependency ứng dụng)

```bash
mkdir -p .qa-local-tool
npm install --prefix .qa-local-tool --no-save --ignore-scripts --no-audit --no-fund playwright@1.65.1
node .qa-local-tool/node_modules/playwright/cli.js install chromium
QA_PLAYWRIGHT_MODULE="$PWD/.qa-local-tool/node_modules/playwright/index.mjs" node scripts/qa/erp-browser-smoke.mjs
```

Báo cáo cục bộ ở `.qa-browser-results/report.json`, đã được ignore. Phiên đăng nhập riêng chỉ được truyền qua `QA_STORAGE_STATE_PATH` trên máy tin cậy; script từ chối cách này khi `GITHUB_ACTIONS=true` và không chụp tự động ảnh authenticated.

## Bảo trì và rollback

Nếu không thấy trạng thái Vercel success, kiểm tra Git integration. Nếu browser bị chặn DNS/network, phân loại là blocker môi trường, không kết luận UI Production hỏng. Nếu job báo lỗi không bình luận issue, kiểm tra quyền GitHub Actions của GITHUB_TOKEN. Tắt workflow trong Actions hoặc revert file workflow để dừng, không cần thay database.

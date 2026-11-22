# AI session logs

Collector lưu phiên của repo này vào `logs/ai-sessions`: prompt, câu trả lời,
lệnh/tool call, output/lỗi và ảnh tool cung cấp. JSON lưu sự kiện, Markdown để đọc.
Giữ dữ liệu đã thu khi nguồn thiếu/cắt ngắn, chống trùng và ghi an toàn.

Thiết lập hook và tự chạy khi đăng nhập Windows (Node 24):

```powershell
npm run logs:setup
```

Điều khiển:

```powershell
npm run logs:start
npm run logs:status
npm run logs:stop
npm run logs:collect
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ai-sessions/manage.ps1 -Uninstall
```

Collector kiểm tra khoảng 2 giây một lần, lọc workspace và đọc lịch sử có sẵn.
Giữ nguyên Codex notify. Đọc metadata workspace Antigravity từ bản sao SQLite
tạm, không sửa database gốc. Đọc thêm output.txt và log tác vụ nền.
Claude dùng transcript và hook repo; Cursor dùng transcript text khi có.

Cursor chưa có transcript repo để kiểm tra thực tế. Nếu vị trí export khác
thư mục tự nhận diện, đăng ký file cụ thể một lần:

```powershell
node scripts/ai-sessions/cli.cjs --source "C:/path/to/session.txt" --provider cursor --session session-id
```

Collector tiếp tục theo dõi file đã đăng ký. App/web không xuất lịch sử cần
tích hợp/export riêng. Không thể khôi phục output mà tool không xuất ra hoặc đã
cắt mất. Che trường credential và mẫu credential phổ biến trong text; bỏ
reasoning nội bộ provider. Ảnh tool lưu ở `assets/`.

File mới: `session-<provider>-<full-id>.md/.json`. Hỗ trợ `latest.md` và alias
Antigravity cũ. Diagnostics, ownership và backup hook ở `.state/`.
Log mới được Git ignore; file đã tracking trước đây vẫn giữ tracking.

Kiểm tra: `npm run lint:ai-sessions`, `npm run typecheck:ai-sessions`,
`npm run test:ai-sessions`, `npm run build:ai-sessions`.
Runtime không cần package mới; kiểm tra dùng dev dependencies có sẵn.

Trạng thái triển khai: collector hiện đang chạy, hook Claude đã cài.
Auto-review chặn bước cập nhật `.agents` và đăng ký task Windows; chạy
`npm run logs:setup` trong terminal của bạn để hoàn tất bước đó.
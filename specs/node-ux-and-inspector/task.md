# Implementation Tasks: Node Documentation, In-App Inspector & Templates

> 🤖 AI làm theo spec. 👤 Bạn duyệt và kiểm tra.
> Không phá vỡ schema database hiện tại; bảo toàn 100% backward compatibility.

---

## Phase 1. Node Documentation (Ưu tiên 1)
- [x] 🤖 Soạn thảo tài liệu chuẩn hóa 15/15 node (`docs/nodes-guide.md`):
  - [x] 🤖 Nhóm Trigger: Manual Trigger, Webhook, Messenger Trigger
  - [x] 🤖 Nhóm Logic: IF, Switch, Filter
  - [x] 🤖 Nhóm Data & Memory: Edit Fields (Set), Aggregate, Chat Memory
  - [x] 🤖 Nhóm AI: LLM (OpenAI, Anthropic, Gemini)
  - [x] 🤖 Nhóm Integration: HTTP Request (SSRF Guard), Read Google Sheet Rows, Send Gmail, Messenger Send Message, Messenger Sender Action
  - [x] 🤖 Mỗi node bắt buộc đủ: Mục đích, Điều kiện cần, Cấu hình từng trường, Output Preview JSON, và Danh sách biểu thức gợi ý cho node sau
- [x] 👤 Bạn duyệt nội dung tài liệu Phase 1

---

## Phase 2. In-App Help & Node Output Inspector (Ưu tiên 2)
- [ ] 🤖 Xây dựng từ điển dữ liệu mẫu `nodeSampleOutputs.ts` cho 15 node type
- [ ] 🤖 Xây dựng component `NodeOutputInspector.tsx` (hiển thị JSON cây đẹp + nút 1-click copy expression `{{$node["Tên"].json.trường}}` và `{{$json.trường}}`)
- [ ] 🤖 Nâng cấp `PropertiesPanel.tsx`: Thêm Tabs (`Cấu hình` / `Dữ liệu đầu ra & Inspector`)
- [ ] 🤖 Thêm tooltip và helper text hiển thị chi tiết cho từng field
- [ ] 🤖 Chạy kiểm thử Frontend (`npx vitest run`) đảm bảo không ảnh hưởng các test hiện có
- [ ] 👤 Bạn mở giao diện Designer, click thử các node và bấm copy biểu thức

---

## Phase 3. Workflow Templates Library (Ưu tiên 3)
- [x] 🤖 Định nghĩa 4 Template chuẩn trong `templates/catalog.ts`:
  1. Messenger AI Chatbot (kèm Chat Memory Redis)
  2. Google Sheets → Email Notification
  3. Messenger → AI Classification → Switch Routing
  4. Webhook → Filter → HTTP Request
- [x] 🤖 Xây dựng giao diện `TemplateGalleryDialog.tsx` (Hiển thị thẻ mẫu, danh sách node, nút "Sử dụng mẫu này")
- [x] 🤖 Gắn nút mở Thư viện mẫu vào Toolbar của `DesignerLayout` và trang `WorkflowListPage`
- [x] 🤖 Cơ chế import template vào Canvas React Flow và tự động lưu Draft
- [ ] 🤖 Kiểm thử luồng tạo workflow từ template
- [ ] 👤 Bạn thử tạo workflow từ template và kiểm tra kết quả


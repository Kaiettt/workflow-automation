# Feature Specification: Node Documentation, In-App Inspector & Workflow Templates

> **Mục tiêu:** Giúp người dùng (developer hoặc người vận hành) hiểu rõ từng node và tự tạo được một workflow chạy thành công từ đầu đến cuối mà không cần hiểu sâu về kỹ thuật.
> **Lộ trình:** 3 Phase liên hoàn (Phase 1: Documentation → Phase 2: In-App Help & Output Inspector → Phase 3: Workflow Templates).

---

## 1. Bối cảnh & Vấn đề (Problem Statement)

Trong các hệ thống Workflow Automation (như n8n, Zapier, Make):
1. **Rào cản nhận thức (Mental Model):** Người dùng kéo một node lên canvas nhưng không thực sự hiểu:
   - Node này sinh ra để làm cái gì trong thực tế đời sống?
   - Cần chuẩn bị những gì trước khi dùng nó (API key ở đâu, quyền gì, điều kiện tiên quyết)?
   - Từng ô trên màn hình cấu hình phải điền cái gì, cú pháp ra sao?
2. **Cấu hình mù quáng (Blind Configuration):**
   - Người dùng không nhìn thấy **dữ liệu thực tế mà node trước tạo ra trông như thế nào**.
   - Do đó, việc bắt họ tự gõ một biểu thức trừu tượng như `{{$node["Messenger Trigger"].json.sender_id}}` hay `{{$json.email}}` là vô cùng khó khăn, dễ sai sót và gây nản lòng.
3. **Chi phí khởi tạo từ số 0 quá cao:** Người dùng đối mặt với một Canvas trắng tinh, không biết bắt đầu nối từ node nào sang node nào để giải quyết các bài toán phổ biến (như Chatbot AI, Gửi mail đơn hàng, Phân loại tin nhắn).

---

## 2. Giải pháp Tổng thể (The 3-Phase Strategy)

Hệ thống triển khai theo lộ trình 3 Phase bổ trợ lẫn nhau:

```
┌─────────────────────────────────┐
│  PHASE 1: Node Documentation    │ ──> Giải quyết: Hiểu cặn kẽ node từ A-Z
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  PHASE 2: In-App Help &         │ ──> Giải quyết: Cấu hình trực quan tại chỗ
│           Node I/O Inspector    │     (Thấy Data Preview + 1-Click Copy Expression)
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  PHASE 3: Workflow Templates    │ ──> Giải quyết: Rút ngắn thời gian tạo từ con số 0
└─────────────────────────────────┘     (Clone mẫu chạy ngay)
```

---

## 3. Chi tiết từng Phase

### Phase 1: Chuẩn hóa Tài liệu Cẩm nang Node (Node Documentation)
Xây dựng tài liệu hướng dẫn thực chiến chuẩn mực cho toàn bộ **15 node** hiện có trong hệ thống, mỗi node bắt buộc gồm 5 phần:
1. **Node dùng để làm gì?** (Giải thích đời thường, ứng dụng thực tế).
2. **Điều kiện cần trước khi dùng** (Tài khoản Google/Meta, API Key, bảng tính, quyền truy cập).
3. **Hướng dẫn cấu hình từng trường** (Từng ô trên Properties Panel: ý nghĩa, bắt buộc/không, giá trị mẫu).
4. **Input & Output Schema Preview (Trọng tâm)**:
   - Dữ liệu JSON thực tế node tạo ra.
   - Danh sách cú pháp biểu thức sẵn sàng copy cho node tiếp theo.
5. **Ví dụ cắm dây thực tế** (Node trước là gì, node sau là gì).

### Phase 2: In-App Help & Node Input/Output Inspector (Tính năng Then chốt)
Đưa tri thức từ tài liệu vào ngay trong giao diện Designer:
1. **Node Header Context:** Hiển thị rõ công dụng tóm tắt và category của node.
2. **Field Tooltips & Placeholders:** Từng ô nhập liệu có nhãn, hint giải thích và placeholder trực quan.
3. **Node Input/Output Inspector (Feature cốt lõi):**
   - Trong Properties Panel, bổ sung tab/khối **Output Preview**:
     - Hiển thị cấu trúc JSON thực tế (hoặc mẫu chuẩn) mà node phát ra.
     - Kèm nút **1-Click Copy Expression** ngay cạnh từng trường JSON:
       - Ví dụ: bên cạnh trường `"sender_id": "123456789"` có nút copy `{{$json.sender_id}}` hoặc `{{$node["Messenger Trigger"].json.sender_id}}`.
     - Người dùng chỉ cần click copy và dán sang ô cấu hình của node sau.
4. **Nút "Xem tài liệu chi tiết"**: Mở modal hoặc link tới tài liệu của node đó.

### Phase 3: Thư viện Quy trình Mẫu (Workflow Templates Library)
Cung cấp sẵn 4 kịch bản quy trình phổ biến nhất:
1. **Messenger AI Chatbot:** `Messenger Trigger → Sender Action (typing) → Chat Memory (load) → LLM → Send Message → Chat Memory (save)`.
2. **Google Sheets → Email Notification:** `Manual Trigger → Read Google Sheet Rows → Send Gmail`.
3. **Messenger → AI Classification → Routing:** `Messenger Trigger → LLM (JSON classify) → Switch → Các nhánh trả lời tương ứng`.
4. **Webhook → HTTP Request → Sync:** `Webhook Trigger → Filter → HTTP Request`.

---

## 4. Phạm vi (Scope)

### Trong phạm vi (In-Scope)
- Hoàn thiện tài liệu 15 node (`docs/nodes-guide.md` hoặc `specs/node-ux-and-inspector/handbook.md`).
- Bổ sung `sampleOutput` (hoặc output schema preview) cho từng node trong Node Catalog (`node_type_definitions`).
- Xây dựng component **Node I/O Inspector** trong `PropertiesPanel` trên Frontend.
- Tích hợp tính năng sao chép nhanh biểu thức (Click-to-copy expression) từ Inspector.
- Xây dựng bảng chọn Workflow Templates trên Designer/Homepage và cơ chế nạp template vào Canvas.

### Ngoài phạm vi (Out-of-Scope)
- Kéo thả dây trực tiếp từ trường JSON này sang ô input khác (Data mapping dạng drag-and-drop giữa 2 panel - để dành cho v2).
- Thay đổi cấu trúc cơ sở dữ liệu cốt lõi (`Workflow`, `Execution`, `ExecutionNodeLog`).
- Viết lại Engine thực thi.

---

## 5. Tiêu chí Chấp nhận (Acceptance Criteria)

1. **Về Documentation:** Tài liệu bao phủ 15/15 node, có JSON Output Preview và danh sách biểu thức gợi ý.
2. **Về Inspector:** Khi người dùng chọn bất kỳ node nào trên Canvas, Properties Panel có thể hiển thị:
   - Preview JSON đầu ra của node đó.
   - Bấm vào một trường trong preview JSON sẽ tự động copy biểu thức tương ứng vào clipboard (ví dụ `{{$json.fieldName}}` hoặc `{{$node["Node Name"].json.fieldName}}`).
3. **Về Khả năng mở rộng:** Schema của các node không bị gãy hoặc lỗi thời khi mở rộng node mới.


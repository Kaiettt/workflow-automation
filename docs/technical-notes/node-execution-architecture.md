# Technical Notes — Kiến trúc Thực thi một Node (Node Execution Architecture)

---

## Chu trình thực thi 1 Node (The Node Lifecycle)

Mỗi khi Execution Engine lấy 1 node ra để chạy, nó phải đi qua 5 giai đoạn chính:

```mermaid
flowchart TD
    A[Bắt đầu Node] --> B[1. Context Parsing & Interpolation]
    B --> C[2. Credential Resolution]
    C --> D[3. Execution (Runner)]
    D --> E[4. Output Normalization]
    D -- Lỗi --> F[Error Handling & Retry Policy]
    F -- Hết Retry --> G[Ghi Log FAILED]
    F -- Còn Retry --> D
    E --> H[Ghi Log SUCCESS]
```

### 1. Context Parsing & Interpolation (Đổ dữ liệu động)
Người dùng rất hiếm khi cấu hình tĩnh (hardcode). Họ thường trỏ dữ liệu từ node trước sang node sau. Ví dụ, nhập vào ô `text` của Slack nội dung:
> `"Có khách hàng mới: {{ node_123.output.name }} - Email: {{ node_123.output.email }}"`

**Cách giải quyết:**
- Trước khi chạy hàm xử lý, Executor phải chạy qua một bộ **Data Parser** (thường dùng regex hoặc thư viện như Handlebars/JSONPath).
- Parser sẽ nhận vào `nodeData.config` và đối tượng `Execution Context` (chứa toàn bộ output của các node trước đó).
- Nó quét tất cả các chuỗi (string) trong config, tìm kiếm biểu thức `{{ ... }}` và thay thế bằng dữ liệu thật (đã được sanitize).
- Kết quả trả về là một `resolvedConfig` (Cấu hình đã nội suy), lúc này chuỗi trên trở thành `"Có khách hàng mới: Nguyễn Văn A - Email: a@gmail.com"`.

### 2. Credential Resolution (Giải quyết chứng chỉ bảo mật)
Khi gọi 1 API bên thứ 3, node cần Token/API Key. Nhưng Token này **tuyệt đối không** nằm trong JSON định nghĩa workflow (vì JSON có thể được share hoặc xem bởi admin). Trong JSON chỉ chứa `credential_id` (tham chiếu).

**Cách giải quyết:**
- Dùng `credential_id` để query xuống bảng `connector_credentials`.
- Lấy chuỗi `encrypted_secret` và đưa qua hàm giải mã (AES-256) ở tầng ứng dụng bằng Master Key.
- Bơm token dạng Plain-text này vào một biến cục bộ, truyền vào hàm thực thi (Runner).
- **Nguyên tắc tử thủ:** Token này chỉ tồn tại trong RAM ở function scope, cấm tuyệt đối việc in ra màn hình hoặc ghi vào log (bước 5).

### 3. Execution (Runner)
Đây là nơi mã nguồn đặc thù của từng loại node (vd: `SlackPostMessageRunner`, `HttpRunner`, `PostgresQueryRunner`) thực sự chạy.

**Cách giải quyết sự phức tạp:**
- **Timeout Isolation:** Mọi hàm Runner phải bị giới hạn thời gian (Timeout). Ví dụ gọi API quá 30s thì phải bị văng lỗi (TimeoutException) để tránh làm kẹt toàn bộ worker thread của hệ thống.
- **Dependency Injection:** Runner không tự gọi thư viện HTTP tùy tiện. Hệ thống phải cấp (inject) một `HTTPClient` dùng chung đã cấu hình sẵn proxy, user-agent, và các giới hạn bảo mật (SSRF protection - chống user gọi HTTP tới mạng nội bộ `localhost` hay IP local của hệ thống).

### 4. Error Handling & Retry Policy (Xử lý lỗi và thử lại)
Gọi API ra ngoài rất dễ bị lỗi mạng (500, 502, 503) hoặc lỗi Rate Limit (429).

**Cách giải quyết:**
- Node config có thể chứa cấu hình Retry: `{"retries": 3, "backoff": "exponential"}`.
- Nếu Runner ném ra lỗi (Throw Exception), Executor bắt được (Catch).
- Nó kiểm tra xem lỗi đó là **Transient** (Lỗi tạm thời như 502) hay **Fatal** (Lỗi không thể cứu vãn như 401 Sai mật khẩu).
- Nếu là Transient và còn lượt thử, nó đưa node đó vào chế độ ngủ (Sleep) bằng cơ chế Queue (ví dụ ném lại vào RabbitMQ/Redis kèm theo bộ đếm delay) rồi mới chạy lại, thay vì chặn (block) tiến trình hiện tại.

### 5. Output Normalization & Logging (Chuẩn hóa đầu ra và Ghi log)
Giả sử API Slack trả về một cục XML hoặc text thô, hoặc một cục JSON lộn xộn.

**Cách giải quyết:**
- Runner phải chuẩn hóa kết quả về thành một cục JSON tiêu chuẩn.
- Dữ liệu này được đẩy vào `Execution Context` dưới key `context[node_id].output = {...}` để các node phía sau xài.
- Cuối cùng, một tiến trình bất đồng bộ (Async) sẽ ghi thông tin (input đã nội suy + output) vào bảng `execution_node_logs`.
- **Sanitize Log:** Trước khi ghi log xuống DB, phải có một bộ lọc xoá sạch các thông tin nhạy cảm (như Authorization header, password) khỏi `input`.

---

## Trừu tượng hóa bằng Code (OOP/Interface)

Để không phải viết code if-else cho hàng trăm loại node, kiến trúc Code Backend thường ép mọi node phải tuân thủ một Interface duy nhất (Polymorphism):

```typescript
// Interface bắt buộc cho TẤT CẢ các node
interface INodeRunner {
  // Hàm này quy định node cần credential gì
  getRequiredCredentialTypes(): string[]; 
  
  // Hàm thực thi chính
  execute(
    resolvedConfig: any,       // Config đã nội suy {{ ... }}
    credential: any,           // Token thật (đã giải mã)
    context: ExecutionContext  // Dữ liệu dùng chung
  ): Promise<any>;             // Trả về JSON output
}
```

Nhờ kiến trúc chuẩn hoá như vậy:
- Việc xử lý biến số động (`{{...}}`), giải mã token, ghi log, bắt lỗi **được viết đúng 1 lần** ở lớp Engine (lớp bao bọc).
- Còn người lập trình thêm 1 Connector mới (ví dụ viết node gửi tin nhắn Telegram) **chỉ việc quan tâm viết logic bên trong hàm `execute()`** là xong. Nó chia tách độ phức tạp hệ thống rất hoàn hảo.

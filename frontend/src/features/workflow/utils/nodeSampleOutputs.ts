export interface ExpressionShortcut {
  label: string;
  field: string;
  description: string;
  example: string;
}

export interface NodeOutputSample {
  data: Record<string, unknown>;
  description: string;
  shortcuts: ExpressionShortcut[];
}

export const NODE_SAMPLE_OUTPUTS: Record<string, NodeOutputSample> = {
  'trigger.manual': {
    description: 'Manual Trigger khởi tạo một item rỗng để bắt đầu luồng dữ liệu.',
    data: {},
    shortcuts: [],
  },

  'webhook.trigger': {
    description: 'Dữ liệu nhận được từ HTTP POST Webhook của hệ thống bên ngoài.',
    data: {
      body: {
        order_id: 'ORD-9988',
        customer_name: 'Nguyễn Văn A',
        customer_email: 'nguyenvana@gmail.com',
        total_amount: 1250000,
        items_count: 2,
      },
      headers: {
        'content-type': 'application/json',
      },
      query: {},
    },
    shortcuts: [
      { label: 'Mã đơn hàng', field: 'body.order_id', description: 'Mã đơn từ webhook', example: 'ORD-9988' },
      { label: 'Email khách hàng', field: 'body.customer_email', description: 'Email của khách', example: 'nguyenvana@gmail.com' },
      { label: 'Tên khách hàng', field: 'body.customer_name', description: 'Họ tên khách hàng', example: 'Nguyễn Văn A' },
      { label: 'Tổng tiền', field: 'body.total_amount', description: 'Số tiền thanh toán', example: '1250000' },
    ],
  },

  'messenger.trigger': {
    description: 'Dữ liệu tin nhắn hoặc sự kiện bấm nút từ khách hàng trên Facebook Messenger.',
    data: {
      type: 'message',
      message_id: 'mid.1794031200:a8f9c1b2',
      sender_id: '8492019481029481',
      page_id: '100294819201948',
      text: 'Shop ơi cho mình hỏi giá bàn phím cơ bên bạn?',
      payload: null,
      timestamp: '2026-11-07T08:30:00.000Z',
    },
    shortcuts: [
      { label: 'ID Khách (Sender ID)', field: 'sender_id', description: 'Bắt buộc cho Recipient ID của node gửi tin', example: '8492019481029481' },
      { label: 'Nội dung tin nhắn', field: 'text', description: 'Nội dung khách nhắn, đưa vào Prompt AI', example: 'Shop ơi cho mình hỏi giá...' },
      { label: 'ID Fanpage', field: 'page_id', description: 'ID Page nhận tin', example: '100294819201948' },
      { label: 'Payload nút bấm', field: 'payload', description: 'Giá trị trả về khi khách bấm Quick Reply/Button', example: 'PRICE_INQUIRY' },
    ],
  },

  'logic.if': {
    description: 'Chuyển tiếp item nguyên vẹn sang cổng True (thỏa mãn) hoặc False (không thỏa mãn).',
    data: {
      text: 'Shop ơi cho mình hỏi giá...',
      sender_id: '8492019481029481',
    },
    shortcuts: [
      { label: 'Dữ liệu nhánh True/False', field: 'text', description: 'Kế thừa toàn bộ trường của node trước', example: '...' },
    ],
  },

  'logic.switch': {
    description: 'Passes the input item unchanged through the matching rule output or fallback.',
    data: {
      text: 'Product price inquiry',
      matched_rule: 'Hỏi giá',
    },
    shortcuts: [
      { label: 'Routed item data', field: 'text', description: 'Inherits data from the previous node', example: '...' },
    ],
  },

  'logic.filter': {
    description: 'Cho phép item thỏa mãn điều kiện đi tiếp; item không thỏa mãn bị loại bỏ hoàn toàn.',
    data: {
      status: 'PENDING',
      order_id: 'ORD-12345',
    },
    shortcuts: [
      { label: 'Trạng thái', field: 'status', description: 'Trường đã qua bộ lọc', example: 'PENDING' },
    ],
  },

  'data.set': {
    description: 'Dữ liệu sau khi đã gán thêm các trường mới hoặc biến đổi cấu trúc.',
    data: {
      full_name: 'Nguyễn Văn A',
      email: 'nguyenvana@gmail.com',
      greeting: 'Xin chào Nguyễn Văn A!',
    },
    shortcuts: [
      { label: 'Họ và tên mới', field: 'full_name', description: 'Trường vừa được gán', example: 'Nguyễn Văn A' },
      { label: 'Lời chào', field: 'greeting', description: 'Chuỗi ghép', example: 'Xin chào Nguyễn Văn A!' },
    ],
  },

  'data.aggregate': {
    description: 'Toàn bộ danh sách nhiều item phía trước được gom lại thành 1 mảng duy nhất.',
    data: {
      items: [
        { id: 1, product: 'Bàn phím cơ AK820', price: 850000 },
        { id: 2, product: 'Chuột không dây X1', price: 450000 },
      ],
    },
    shortcuts: [
      { label: 'Toàn bộ mảng items', field: 'items', description: 'Mảng danh sách các dòng đã gom', example: '[{...}, {...}]' },
      { label: 'Số lượng item', field: 'items.length', description: 'Tổng số dòng dữ liệu gom được', example: '2' },
      { label: 'Phần tử đầu tiên', field: 'items[0].product', description: 'Sản phẩm đầu tiên trong mảng', example: 'Bàn phím cơ AK820' },
    ],
  },

  'memory.chat': {
    description: 'Lịch sử hội thoại được nạp từ Redis (ở chế độ Load) để đưa vào AI LLM.',
    data: {
      history: [
        { role: 'user', content: 'Shop có bán bàn phím cơ không?' },
        { role: 'assistant', content: 'Dạ bên mình có nhiều mẫu bàn phím cơ chính hãng ạ!' },
      ],
      history_text: 'User: Shop có bán bàn phím cơ không?\nAssistant: Dạ bên mình có nhiều mẫu bàn phím cơ chính hãng ạ!',
    },
    shortcuts: [
      { label: 'Lịch sử hội thoại (History)', field: 'history', description: 'Dán trực tiếp vào ô Conversation history của node LLM', example: '[{role, content}]' },
      { label: 'Lịch sử dạng văn bản', field: 'history_text', description: 'Chuỗi text nối các lượt thoại', example: 'User: ... Assistant: ...' },
    ],
  },

  'ai.llm.generate': {
    description: 'Kết quả phản hồi được tạo ra từ mô hình AI (OpenAI / Claude / Gemini).',
    data: {
      text: 'Dạ mẫu bàn phím cơ AK820 bên em đang có giá ưu đãi là 790.000 VNĐ kèm bảo hành 12 tháng ạ!',
      model: 'gpt-4o-mini',
      usage: {
        input_tokens: 128,
        output_tokens: 42,
      },
    },
    shortcuts: [
      { label: 'Câu trả lời của AI', field: 'text', description: 'Nội dung phản hồi AI, dùng gửi cho khách hoặc ghi chú', example: 'Dạ mẫu bàn phím cơ...' },
      { label: 'Tên model đã chạy', field: 'model', description: 'Model AI đã xử lý', example: 'gpt-4o-mini' },
      { label: 'Số token output', field: 'usage.output_tokens', description: 'Số token đã tiêu tốn', example: '42' },
    ],
  },

  'http.request': {
    description: 'Dữ liệu phản hồi từ Web API bên ngoài sau khi gọi HTTP Request.',
    data: {
      status: 200,
      data: {
        success: true,
        order_id: 'ORD-7788',
        tracking_code: 'VNPOST-9921',
      },
      headers: {
        'content-type': 'application/json',
      },
    },
    shortcuts: [
      { label: 'Dữ liệu phản hồi (data)', field: 'data', description: 'Toàn bộ nội dung JSON API trả về', example: '{"success": true, ...}' },
      { label: 'Mã HTTP Status', field: 'status', description: 'Mã phản hồi HTTP (200, 201, 400...)', example: '200' },
      { label: 'Mã vận đơn', field: 'data.tracking_code', description: 'Trường lồng nhau từ response API', example: 'VNPOST-9921' },
    ],
  },

  'integration.google_sheet.readRows': {
    description: 'Dữ liệu một dòng đọc từ Google Sheet. Nếu có nhiều dòng, mỗi dòng là một item tương tự.',
    data: {
      row_number: 2,
      'Họ và tên': 'Nguyễn Văn A',
      Email: 'nguyenvana@gmail.com',
      'Số điện thoại': '0912345678',
      'Trạng thái': 'Chưa xử lý',
    },
    shortcuts: [
      { label: 'Cột Họ và tên', field: '["Họ và tên"]', description: 'Cột có khoảng trắng hoặc dấu tiếng Việt', example: 'Nguyễn Văn A' },
      { label: 'Cột Email', field: 'Email', description: 'Cột email người nhận', example: 'nguyenvana@gmail.com' },
      { label: 'Cột Số điện thoại', field: '["Số điện thoại"]', description: 'Cột SĐT', example: '0912345678' },
      { label: 'Số thứ tự dòng', field: 'row_number', description: 'Vị trí dòng trong Google Sheet', example: '2' },
    ],
  },

  'integration.gmail.send': {
    description: 'Kết quả sau khi gửi thư điện tử qua Gmail thành công.',
    data: {
      message_id: '18c2f1a980b192cd',
      to: 'nguyenvana@gmail.com',
      sent: true,
    },
    shortcuts: [
      { label: 'Message ID', field: 'message_id', description: 'Mã định danh email từ Google', example: '18c2f1a9...' },
      { label: 'Trạng thái gửi', field: 'sent', description: 'true nếu gửi thành công', example: 'true' },
    ],
  },

  'messenger.sendMessage': {
    description: 'Kết quả phản hồi từ Meta Graph API sau khi gửi tin nhắn Messenger.',
    data: {
      page_id: '100294819201948',
      recipient_id: '8492019481029481',
      message_id: 'm_1792837192',
      status: 'sent',
    },
    shortcuts: [
      { label: 'Message ID', field: 'message_id', description: 'Mã tin nhắn vừa gửi đi', example: 'm_1792837192' },
      { label: 'Trạng thái gửi', field: 'status', description: 'Trạng thái tin nhắn', example: 'sent' },
    ],
  },

  'messenger.senderAction': {
    description: 'Kết quả phản hồi sau khi gửi hiệu ứng tương tác (đang soạn tin, đã xem).',
    data: {
      page_id: '100294819201948',
      recipient_id: '8492019481029481',
      action: 'typing_on',
      status: 'sent',
    },
    shortcuts: [
      { label: 'Hành động đã gửi', field: 'action', description: 'typing_on / typing_off / mark_seen', example: 'typing_on' },
      { label: 'Trạng thái', field: 'status', description: 'Trạng thái gửi', example: 'sent' },
    ],
  },
};


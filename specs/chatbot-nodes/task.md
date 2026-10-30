# Implementation Tasks: Node cho chatbot

> 🤖 Claude làm trong repo. 👤 Bạn làm / kiểm tra.
> Không commit / push khi chưa được bạn đồng ý. Làm theo thứ tự P1 → P6; mỗi phần chạy unit + e2e liên quan trước khi sang phần sau.

## P1. Engine chạy đồ thị
- [x] 🤖 `buildGraphPlan` thay `getExecutionOrder`: topo (Kahn), kiểm chu trình, đúng một node bắt đầu, cạnh trỏ node có thật
- [x] 🤖 `resolveOutputs(schema, config)` (`libs/shared/src/utils/node-outputs.ts`) + `x-outputs` (`static` / `fromConfig`); chưa có node type nào dùng, P2 thêm IF/Switch
- [x] 🤖 Executor trả `RoutedItem`; `NodeRunner` trả `outputs: Map<string, Item[]>`
- [x] 🤖 `WorkflowEngine` chạy theo topo, quy tắc kích hoạt cạnh, ghi log `SKIPPED`
- [x] 🤖 `NodeRun.inputSources` (`runs` vẫn là mảng theo thứ tự topo), `getPairedJson` đi theo nguồn gốc
- [x] 🤖 `start-execution.command.ts` dùng `buildGraphPlan`
- [x] 🤖 Publish: `GRAPH_CYCLE`, `MULTIPLE_START`, `UNKNOWN_OUTPUT` (cả ba là lỗi, không phải cảnh báo)
- [x] 🤖 Unit: chuỗi cũ không đổi, rẽ nhánh, gộp, skip lan truyền, chu trình, pairing qua nhánh / gộp
- [x] 🤖 Frontend: handle đầu ra có nhãn trong `BaseNode`, nhãn trên cạnh, `SKIPPED` ở trang execution
- [ ] 🤖 Chạy toàn bộ e2e hiện có (kỳ vọng như trước: chỉ 2 test fail sẵn trên `master`)

## P2. IF / Switch / Edit Fields
- [x] 🤖 `domain/conditions.ts` (toán tử, AND/OR, bỏ hoa thường / dấu, giới hạn regex)
- [x] 🤖 `logic.if`, `logic.switch` (mode first / all), `data.set` + seed node type; biểu thức trong config dạng danh sách (`rules[0].conditions[1].value2`)
- [x] 🤖 Frontend: `ListField` (danh sách điều kiện / luật / trường), `BooleanField`; xoá luật Switch thì xoá cạnh nối từ đầu ra đó
- [x] 🤖 Unit cho từng toán tử, executor và luồng chatbot; e2e: webhook → Switch → hai nhánh, nhánh kia `SKIPPED`; publish chặn cạnh từ luật đã xoá

## P3. Chat Memory
- [ ] 🤖 Tham số `context { workflowId, executionId }` cho executor
- [ ] 🤖 `memory.chat` (load / save / clear) trên Redis + seed node type
- [ ] 🤖 `LlmGenerateRequest.history`; ba adapter gửi nhiều lượt; config LLM `history`
- [ ] 🤖 Unit (Redis giả, adapter); e2e: hai tin liên tiếp, lần hai LLM nhận lịch sử

## P4. Messenger
- [ ] 🤖 Trigger: postback, quick_reply payload, `type` / `payload`, property `events`, field `messaging_postbacks` + `checkExists` kiểm fields
- [ ] 🤖 Hợp đồng package: `NodeProperty.type = 'collection'`; JSON Schema; frontend `CollectionField`
- [ ] 🤖 Send Message: quick replies, buttons, attachment; `MetaGraphApi.sendMessage`; lỗi 24 giờ
- [ ] 🤖 `messenger.senderAction`
- [ ] 🤖 Unit + e2e với Graph giả
- [ ] 👤 Thử với Page thật: bấm quick reply / nút, xem workflow chạy lại

## P5. HTTP Request
- [ ] 🤖 Package `http` + 3 credential type; `credentialTypes` trong hợp đồng và `PackageActionExecutor`
- [ ] 🤖 Chặn SSRF (DNS, redirect), `HTTP_REQUEST_ALLOW_PRIVATE`, giới hạn 5 MB, timeout
- [ ] 🤖 Unit (server giả, các dải IP bị chặn)

## P6. Sửa nhỏ
- [ ] 🤖 Gợi ý tên node gần đúng trong lỗi biểu thức

## Cuối
- [ ] 🤖 Lint backend + frontend, frontend test + build, unit, e2e
- [ ] 🤖 Cập nhật `docs/setup/messenger.md` (quick replies, postback, ví dụ chatbot ở spec mục 2), `docs/schema/*` (`x-outputs`, `collection`)
- [ ] 👤 Dựng chatbot mẫu trên giao diện, duyệt

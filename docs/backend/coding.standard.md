# FlowPilot – Backend Coding Standard (NestJS)

Áp dụng cho toàn bộ backend, đồng bộ với kiến trúc **Modular Monolith + Clean Architecture + CQRS** đã đề xuất.

---

## 1. Naming Convention

| Đối tượng | Convention | Ví dụ |
|---|---|---|
| File | kebab-case + suffix theo loại | `start-execution.handler.ts`, `execution.module.ts` |
| Class | PascalCase + suffix theo loại | `StartExecutionHandler`, `ExecutionModule`, `WorkflowExecution` (entity) |
| Interface (port) | PascalCase, không tiền tố `I` trừ node/connector contract | `ConnectorInvokerPort`, nhưng `INodeDefinition`, `IConnector` (giữ tiền tố cho các contract plugin để phân biệt rõ với class implement) |
| Enum | PascalCase, giá trị UPPER_SNAKE_CASE | `enum ExecutionStatus { RUNNING, SUCCESS, FAILED }` |
| Biến, hàm | camelCase | `workflowId`, `validateWorkflow()` |
| Hằng số | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| DTO | PascalCase + suffix `Dto` | `CreateWorkflowDto`, `ExecutionResponseDto` |
| Command / Query / Event | PascalCase + suffix rõ loại | `StartExecutionCommand`, `GetExecutionStatusQuery`, `ExecutionCompletedEvent` |
| Module folder | kebab-case, số ít | `execution/`, `node-library/` (không dùng `executions/`) |
| Database table (Prisma) | snake_case, số nhiều | `workflow_executions`, `node_executions` |

---

## 2. Cấu trúc file & layer rules

Tuân thủ layer trong mục 3 của tài liệu kiến trúc (`domain → application → infrastructure → presentation`). Quy tắc phụ thuộc **một chiều**:

```
presentation → application → domain
infrastructure → application, domain
```

- **`domain/`**: KHÔNG import bất cứ gì từ NestJS (`@nestjs/*`), Prisma, hay thư viện HTTP. Chỉ pure TypeScript (entity, value object, domain service, repository interface).
- **`application/`**: chứa command/query handler, orchestration logic. Được phép dùng `@nestjs/cqrs`, nhưng KHÔNG import trực tiếp Prisma client hay class từ `infrastructure/`.
- **`infrastructure/`**: implement interface định nghĩa ở `domain/repositories` và `application/ports`. Đây là nơi duy nhất được import Prisma, BullMQ, HTTP client...
- **`presentation/`**: controller/resolver, chỉ gọi vào `application/` (dispatch command/query qua `CommandBus`/`QueryBus`), không chứa business logic.
- **Không import chéo giữa 2 module domain** ngoại trừ qua `index.ts` public API của module đó (đã nêu ở tài liệu kiến trúc, mục 5).

**Enforce bằng ESLint**: dùng `eslint-plugin-boundaries` hoặc `dependency-cruiser` để chặn import sai layer/module ngay ở CI, không chỉ dựa vào code review.

---

## 3. Module & Dependency Injection

- Mỗi module NestJS (`*.module.ts`) chỉ `export` những provider cần thiết cho module khác dùng (facade/service), KHÔNG export repository hay internal handler.
- Ưu tiên **constructor injection**, không dùng property injection.
- Mọi cross-module dependency phải khai báo qua **interface (port)**, bind implementation bằng token trong module đó:

```typescript
// execution.module.ts
{
  provide: ConnectorInvokerPort,
  useClass: ConnectorInvokerAdapter,
}
```

- Không dùng `forwardRef` để né circular dependency giữa 2 module domain — nếu xảy ra circular, đó là dấu hiệu ranh giới module sai, cần refactor lại (tách concern hoặc thêm module trung gian).

---

## 4. CQRS Convention

- 1 Command/Query = 1 file riêng, đặt cùng folder với Handler tương ứng (`start-execution/start-execution.command.ts` + `start-execution.handler.ts`).
- Command/Query object là **immutable** (dùng `readonly` cho toàn bộ property).
- Handler chỉ chứa **1 orchestration flow duy nhất**, không nhét thêm business rule phức tạp — business rule thuộc về domain entity/domain service, Handler chỉ gọi.
- Handler không return domain entity trực tiếp ra `presentation/` — map qua DTO/ViewModel trước khi trả về controller.
- Event handler (side-effect: ghi log, cập nhật monitoring) phải **idempotent** — vì khi tách message queue sau này, có thể nhận event trùng lặp.

---

## 5. Error Handling

- Định nghĩa exception domain riêng trong `shared-kernel/errors/`, kế thừa từ 1 base class chung (`DomainException`), KHÔNG throw `Error` thô trong domain/application layer.
- Chỉ tại `presentation/` (exception filter) mới map domain exception → HTTP status code cụ thể, dùng `@Catch()` filter tập trung (`AllExceptionsFilter`), không xử lý try/catch rải rác trong từng controller.
- Không nuốt lỗi (`catch {}` rỗng) — tối thiểu phải log lại qua `Logger` chuẩn của module đó.
- Lỗi thuộc về infrastructure (DB timeout, connector unreachable) phải được convert thành domain exception có ý nghĩa nghiệp vụ trước khi ném lên application layer (VD: `ConnectorUnavailableException`), không để leak raw Prisma/HTTP error lên trên.

---

## 6. Validation

- DTO ở `presentation/` dùng `class-validator` + `class-transformer`, bật `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` global.
- Validate cấu trúc dữ liệu đầu vào (schema-level) ở DTO; validate rule nghiệp vụ (VD: workflow không được có node mồ côi) thuộc domain service, không nhét vào DTO/pipe.

---

## 7. Testing

| Loại test | Phạm vi | Vị trí |
|---|---|---|
| Unit test | Domain entity, domain service, command/query handler (mock port) | Cùng cấp file, hậu tố `.spec.ts` |
| Integration test | Infrastructure (repository thật với DB test/container) | `infrastructure/**/*.integration-spec.ts` |
| E2E test | Presentation layer, gọi qua HTTP thật | `apps/api/test/*.e2e-spec.ts` |

- Domain và application layer phải đạt coverage cao (mock hoàn toàn infrastructure qua interface) vì đây là phần chứa business logic quan trọng nhất.
- Không mock Prisma trực tiếp trong test business logic — nếu thấy cần mock Prisma, nghĩa là logic đang nằm sai layer (nên nằm ở domain/application, test qua mock repository interface).

---

## 8. Logging & Observability

- Dùng logger chuẩn hoá qua `shared-infra` (wrap `pino` hoặc NestJS `Logger`), mỗi module tự inject logger với context = tên module.
- Log tối thiểu: `workflowId`, `executionId`, `nodeId` (nếu có) trong mọi log liên quan đến execution — phục vụ trace theo NFR observability.
- **KHÔNG log giá trị nhạy cảm**: credential, token, API key, raw payload chứa PII — che (`mask`) trước khi log, đúng NFR-04 trong SRS.
- Log ở mức `error` phải kèm đủ context để debug mà không cần lookup thêm (không log message chung chung như `"Error occurred"`).

---

## 9. Git & Commit Convention

- Theo **Conventional Commits**: `feat(execution): add retry mechanism for node execution`, `fix(connector): handle timeout when testing connection`.
- Prefix theo tên module: `feat(designer)`, `fix(execution)`, `chore(shared-kernel)`.
- Mỗi PR nên giới hạn trong 1 module hoặc 1 concern rõ ràng, tránh PR sửa nhiều module không liên quan cùng lúc — dễ review và dễ trace khi cần rollback theo NFR modular.

---

## 10. Linting & Formatting

- ESLint (`@typescript-eslint`) + Prettier bắt buộc chạy qua `pre-commit hook` (Husky + lint-staged).
- Bật `strict: true` trong `tsconfig.json` (bao gồm `strictNullChecks`, `noImplicitAny`) — bắt buộc cho toàn bộ domain/application layer vì đây là phần logic nghiệp vụ cốt lõi.
- Không dùng `any` trong domain/application layer; nếu cần kiểu chưa xác định, dùng `unknown` + type guard.
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
  - **Reference by Identity**: Các Domain Entities KHÔNG tham chiếu trực tiếp đến object của domain khác (VD: `connector: Connector` trong `NodeTypeDefinition`), mà CHỈ dùng ID (VD: `connectorId: string`). Điều này đảm bảo Bounded Context lỏng lẻo và chuẩn bị cho việc tách microservices.
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

- Đặt Command và Handler của nó vào chung một file duy nhất với tên `{action}.command.ts`. Tương tự với Query là `{action}.query.ts`. (VD: `start-execution/start-execution.command.ts` chứa cả `StartExecutionCommand` và `StartExecutionHandler`).
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

### 7.1. Nguyên tắc cốt lõi: Tách biệt hoàn toàn (Separation of Concerns)
- **Zero test code in `src/`**: Thư mục `src/` của các module (`libs/`, `apps/`) CHỈ chứa mã nguồn production. Tuyệt đối không đặt file test (`*.spec.ts`), file mock, fixture hay test-helper bên trong cây thư mục `src/`.
- Mọi hoạt động kiểm thử nằm tập trung trong thư mục gốc `test/` của backend.

### 7.2. Phân loại và cấu trúc thư mục kiểm thử

| Loại test | Thư mục | Hậu tố file | Mục đích & Quy ước |
|---|---|---|---|
| **Unit Test** | `test/unit/<module>/...` | `*.spec.ts` | Test độc lập từng Handler, Domain Entity, Service, Mapper. Mock 100% các dependency và port bên ngoài. Cấu trúc thư mục con ánh xạ 1:1 theo layer (`application/`, `domain/`, `infrastructure/`). |
| **Integration Test** | `test/integration/<module>/...` | `*.integration-spec.ts` | Test kiểm tra tích hợp giữa code và hạ tầng thật (Prisma Repository với Postgres, Cache Service với Redis). |
| **E2E Test** | `test/e2e/<module>/...` | `*.e2e-spec.ts` | Test toàn trình từ HTTP API qua `supertest`, kiểm tra đúng status code, schema response và tính toàn vẹn của luồng nghiệp vụ. |
| **Test Support / Fixtures** | `test/support/<module>/...` | `*.test-support.ts` hoặc `*.fixture.ts` | Chứa các In-memory Repository, Fake Port, Object Mother, Builder và Mock API dùng chung cho các bộ test. |

- Domain và application layer phải đạt coverage cao (mock hoàn toàn infrastructure qua interface) vì đây là phần chứa business logic quan trọng nhất.
- Không mock Prisma trực tiếp trong test business logic — sử dụng In-Memory Repository kế thừa domain repository interface (đặt tại `test/support/`).

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
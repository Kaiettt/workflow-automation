# FlowPilot – Đề Xuất Kiến Trúc Backend (NestJS)

**Kiến trúc:** Modular Monolith + Clean Architecture + CQRS
**Mục tiêu:** Chia module theo domain rõ ràng, sẵn sàng tách microservice (đặc biệt Execution Module) mà không phải viết lại business logic.

---

## 1. Nguyên tắc thiết kế

- **Mỗi module = 1 bounded context**, có ranh giới rõ: Designer, NodeLibrary, Connector, Execution, Monitoring, Logging, Versioning.
- **Module chỉ giao tiếp qua interface public** (service/facade export ra `index.ts`), không import thẳng repository/entity nội bộ của module khác → dễ cắt thành service riêng sau này.
- **CQRS trong từng module**: Command (ghi) và Query (đọc) tách biệt, dùng `@nestjs/cqrs` — vừa khớp pattern quen thuộc, vừa giúp Execution Module (nặng write/async) và Monitoring/Logging (nặng read) scale độc lập khi tách ra.
- **Giao tiếp liên module nội bộ hiện tại**: gọi trực tiếp qua DI (function call). Nhưng **bọc qua interface (port/adapter) + event bus nội bộ** (`@nestjs/event-emitter` hoặc CQRS `EventBus`) cho các luồng async (VD: Execution phát `WorkflowExecutionCompletedEvent` → Logging/Monitoring lắng nghe) — sau này thay bằng Kafka/RabbitMQ chỉ cần đổi transport, không đổi handler.

---

## 2. Cấu trúc thư mục tổng thể

```
flowpilot-backend/
├── apps/                             # entrypoint layer — nơi Nest thực sự "chạy", không chứa business logic
│   └── api/                          # NestJS entrypoint (HTTP)
│       └── src/
│           ├── main.ts               # bootstrap ứng dụng (NestFactory.create, listen port)
│           └── app.module.ts         # import tất cả module domain
│
├── libs/                             # dùng nx/monorepo hoặc path alias nếu không dùng nx
│   ├── shared-kernel/                # value objects, base entities, exceptions dùng chung
│   │   └── src/
│   │       ├── domain/               # base class dùng chung cho mọi entity (vd. AggregateRoot)
│   │       ├── errors/               # exception thuần domain (vd. InvalidExecutionStateError)
│   │       └── types/                # type/interface thuần TypeScript dùng xuyên module
│   │
│   ├── shared-infra/                 # config, logger, prisma base client, redis client
│   │   └── src/                      # code biết framework/DB nhưng không biết business rule
│   │
│   └── modules/                      # nơi chứa toàn bộ bounded context, mỗi thư mục = 1 module độc lập
│       ├── designer/                 # Designer Module — FR-WD-*
│       ├── node-library/             # Node Library Module — FR-NL-*
│       ├── connector/                # Connector Framework Module — FR-CF-*
│       ├── execution/                # Execution Module — FR-EX-*, FR-EM-* (xem chi tiết bên dưới)
│       ├── monitoring/               # Monitoring Module — đọc lại execution, không có bảng riêng
│       ├── logging/                  # Logging Module — FR-LG-*
│       └── versioning/               # Versioning Module — FR-VM-*, dùng chung workflow_versions
│
├── prisma/
│   └── schema                        # 1 schema, đặt naming convention theo module
│
├── docker-compose.yml                # dịch vụ hạ tầng local: Postgres, Redis, (BullMQ dashboard nếu cần)
└── nest-cli.json                     # cấu hình monorepo/project cho Nest CLI
```

---

## 3. Cấu trúc bên trong 1 module (ví dụ `execution`)

Clean architecture — tách domain khỏi framework:

```
modules/execution/
├── src/
│   ├── domain/                       # lớp trong cùng — không phụ thuộc framework/DB
│   │   ├── entities/                 # class TypeScript thuần, chứa business rule bất biến
│   │   │   ├── workflow-execution.entity.ts   # entity đại diện 1 lần chạy workflow
│   │   │   └── node-execution.entity.ts       # entity đại diện kết quả chạy 1 node trong execution
│   │   ├── enums/
│   │   │   └── execution-status.enum.ts       # RUNNING | SUCCESS | FAILED | CANCELLED
│   │   └── repositories/             # interface only (port) — domain định nghĩa, không implement
│   │       └── execution.repository.ts        # port lưu/tìm WorkflowExecution
│   │
│   ├── application/                  # điều phối use case — biết domain, không biết hạ tầng cụ thể
│   │   ├── commands/                 # hành động làm thay đổi state (CQRS write side)
│   │   │   ├── start-execution/
│   │   │   │   └── start-execution.command.ts   # chứa cả command (input) và handler (logic điều phối)
│   │   │   └── retry-node/           # command retry cho 1 node thất bại (FR-EX-04)
│   │   ├── queries/                  # chỉ đọc, tách khỏi command (CQRS read side)
│   │   │   ├── get-execution-status/ # phục vụ FR-EM-01 (trạng thái thời gian thực)
│   │   │   └── list-executions/      # phục vụ FR-EM-04 (danh sách execution gần nhất)
│   │   ├── events/                   # domain event để module khác subscribe, không gọi thẳng nhau
│   │   │   ├── execution-completed.event.ts    # Monitoring/Logging module lắng nghe
│   │   │   └── execution-failed.event.ts       # dùng để trigger alert/log lỗi
│   │   ├── ports/                    # interface ra module khác (Connector, NodeLibrary)
│   │   │   └── connector-invoker.port.ts       # port gọi 1 connector khi chạy Integration node
│   │   └── dtos/
│   │       └── execution-status.dto.ts         # shape trả về cho query, tách khỏi entity domain
│   │
│   ├── infrastructure/               # lớp duy nhất được phép "bẩn" — biết Prisma, BullMQ, HTTP
│   │   ├── persistence/
│   │   │   ├── prisma-execution.repository.ts  # implement domain/repositories bằng Prisma
│   │   │   └── mappers/                        # convert Prisma row ↔ domain entity, tránh leak type
│   │   ├── queue/
│   │   │   ├── execution.processor.ts          # BullMQ worker, xử lý job async (parallel execution)
│   │   │   └── execution-queue.module.ts       # đăng ký queue/connection cho module này
│   │   └── adapters/
│   │       └── connector-invoker.adapter.ts    # implement port, gọi sang Connector module — chỗ đổi khi tách microservice
│   │
│   └── presentation/                 # lớp mỏng nhất — chỉ dịch request thành command/query
│       └── http/
│           └── execution.controller.ts         # nhận HTTP request, gọi CommandBus/QueryBus, không chứa business logic
│
│   └── execution.module.ts           # khai báo providers, binding interface ↔ implementation (DI)
│
└── index.ts                          # public API: chỉ export service/facade + DTO cần thiết — chặn import sâu vào internal
```

Các module còn lại (`designer`, `connector`, `node-library`, `monitoring`, `logging`, `versioning`) đi theo **cùng khuôn** domain/application/infrastructure/presentation, độ phức tạp tùy module (VD `logging` không cần CQRS đầy đủ, chỉ cần command ghi + query đọc đơn giản).

---

## 4. Đặc thù kỹ thuật theo từng module

| Module | Đặc thù kỹ thuật |
|---|---|
| **Designer** | CRUD workflow definition (JSON graph) + domain service validate (node mồ côi, cycle...) trước khi publish |
| **Node Library** | Registry pattern — mỗi node type implement chung interface `INodeDefinition`, load động (giống plugin) |
| **Connector** | Interface `IConnector` chuẩn (`execute(input): output`), credential mã hóa qua encryption service riêng (`@nestjs/config` + KMS), không log giá trị nhạy cảm |
| **Execution** | Dùng **BullMQ (Redis)** làm queue thực thi async — mỗi node execution là 1 job, hỗ trợ retry/timeout native của BullMQ, parallel qua job group |
| **Monitoring** | Query module (read-only), dùng WebSocket/SSE (`@nestjs/websockets`) để đẩy trạng thái real-time từ Execution events |
| **Logging** | Ghi append-only, cân nhắc bảng riêng/partition theo thời gian để tối ưu khi data lớn |
| **Versioning** | Snapshot toàn bộ workflow definition mỗi lần publish, diff bằng JSON patch |

---

## 5. Giao tiếp liên module — chuẩn bị cho tách microservice

```typescript
// execution/application/ports/connector-invoker.port.ts
export interface ConnectorInvokerPort {
  invoke(connectorId: string, input: unknown): Promise<unknown>;
}

// execution/infrastructure/adapters/connector-invoker.adapter.ts
// Hiện tại: gọi trực tiếp ConnectorService (cùng process)
@Injectable()
export class ConnectorInvokerAdapter implements ConnectorInvokerPort {
  constructor(private readonly connectorService: ConnectorService) {}

  invoke(connectorId: string, input: unknown) {
    return this.connectorService.execute(connectorId, input);
  }
}
```

Khi tách microservice, chỉ đổi `ConnectorInvokerAdapter` thành gọi qua HTTP/gRPC/message queue — domain và application layer của `execution` **không đổi gì**.

---

## 6. Thứ tự implement đề xuất

1. `shared-kernel` + `shared-infra` (base entity, exception, prisma client, logger)
2. `node-library` + `connector` (nền tảng cho designer/execution dùng)
3. `designer` (CRUD + validate)
4. `execution` (engine — phần lõi, phức tạp nhất)
5. `monitoring` + `logging` (song song với execution vì phụ thuộc event)
6. `versioning` (phụ thuộc designer)
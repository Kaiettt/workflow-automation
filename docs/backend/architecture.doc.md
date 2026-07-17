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
├── apps/
│   └── api/                          # NestJS entrypoint (HTTP)
│       └── src/
│           ├── main.ts
│           └── app.module.ts         # import tất cả module domain
│
├── libs/                             # dùng nx/monorepo hoặc path alias nếu không dùng nx
│   ├── shared-kernel/                # value objects, base entities, exceptions dùng chung
│   │   └── src/
│   │       ├── domain/
│   │       ├── errors/
│   │       └── types/
│   │
│   ├── shared-infra/                 # config, logger, prisma base client, redis client
│   │   └── src/
│   │
│   └── modules/
│       ├── designer/
│       ├── node-library/
│       ├── connector/
│       ├── execution/
│       ├── monitoring/
│       ├── logging/
│       └── versioning/
│
├── prisma/
│   └── schema                 # 1 schema, đặt naming convention theo module
│
├── docker-compose.yml
└── nest-cli.json
```

---

## 3. Cấu trúc bên trong 1 module (ví dụ `execution`)

Clean architecture — tách domain khỏi framework:

```
modules/execution/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── workflow-execution.entity.ts
│   │   │   └── node-execution.entity.ts
│   │   ├── value-objects/
│   │   │   └── execution-status.vo.ts
│   │   └── repositories/             # interface only (port)
│   │       └── execution.repository.ts
│   │
│   ├── application/
│   │   ├── commands/
│   │   │   ├── start-execution/
│   │   │   │   ├── start-execution.command.ts
│   │   │   │   └── start-execution.handler.ts
│   │   │   └── retry-node/
│   │   ├── queries/
│   │   │   ├── get-execution-status/
│   │   │   └── list-executions/
│   │   ├── events/
│   │   │   ├── execution-completed.event.ts
│   │   │   └── execution-failed.event.ts
│   │   └── ports/                    # interface ra module khác (Connector, NodeLibrary)
│   │       └── connector-invoker.port.ts
│   │
│   ├── infrastructure/
│   │   ├── persistence/
│   │   │   ├── prisma-execution.repository.ts   # implement domain/repositories
│   │   │   └── mappers/
│   │   ├── queue/
│   │   │   ├── execution.processor.ts           # BullMQ worker
│   │   │   └── execution-queue.module.ts
│   │   └── adapters/
│   │       └── connector-invoker.adapter.ts      # gọi sang Connector module
│   │
│   ├── presentation/
│   │   ├── http/
│   │   │   ├── execution.controller.ts
│   │   │   └── dto/
│   │   └── graphql/ (nếu cần)
│   │
│   └── execution.module.ts
│
└── index.ts                          # public API: chỉ export service/facade + DTO cần thiết
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
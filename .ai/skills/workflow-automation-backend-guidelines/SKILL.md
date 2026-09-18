---
name: Backend Guidelines
description: Guidelines for NestJS backend development, following Modular Monolith, Clean Architecture, and CQRS. Trigger this when modifying or creating backend NestJS code.
---

# FlowPilot Backend Coding Standard (NestJS)

You must follow these rules when developing the backend:

## 1. Architecture
- **Architecture**: Modular Monolith + Clean Architecture + CQRS.
- **Layers**: 
  - `domain/`: pure TS, no frameworks (entities, interfaces).
  - `application/`: CQRS commands/queries, orchestration logic.
  - `infrastructure/`: Prisma, BullMQ, external APIs.
  - `presentation/`: HTTP controllers/resolvers.
- Dependencies go one way: `presentation -> application -> domain` and `infrastructure -> application, domain`. No inter-module domain imports.

## 2. Naming Conventions
- **Files**: kebab-case (e.g., `start-execution.handler.ts`)
- **Classes**: PascalCase (e.g., `StartExecutionHandler`)
- **Interfaces**: PascalCase, NO `I` prefix (except node/connector plugins like `INodeDefinition`).
- **Database Tables (Prisma)**: snake_case, plural (e.g., `workflow_executions`).

## 3. CQRS & Logic
- One Command/Query per file, same folder as Handler.
- Handlers contain 1 orchestration flow, domain entities/services hold business rules.
- DO NOT return domain entities directly to `presentation/`, map to DTOs.

## 4. General
- Exception handling: Custom domain exceptions, catch globally in presentation.
- Validation: DTOs via `class-validator`, business validation in domain services.
- Modules only export what's needed for other modules. No `forwardRef`.

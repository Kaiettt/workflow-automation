import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Server } from 'node:http';
import request from 'supertest';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import { ExecutionController } from '@app/execution/presentation/http/execution.controller';
import { ExecutionEventPublisher } from '@app/execution/application/ports/execution-event-publisher.port';

describe('Execution async API', () => {
  let app: INestApplication;
  const getServer = (): Server => app.getHttpServer() as Server;
  const execution = {
    id: 'execution-1',
    workflowId: 'workflow-1',
    workflowVersionId: 'version-1',
    triggerType: 'MANUAL',
    status: 'QUEUED',
    queuedAt: '2026-11-07T10:00:00.000Z',
    startedAt: null,
    nodeLogs: [],
  };
  const history = { items: [execution], nextCursor: null };
  const commandBus = {
    execute: jest.fn().mockResolvedValue(execution),
  };
  const queryBus = {
    execute: jest
      .fn()
      .mockResolvedValueOnce(execution)
      .mockResolvedValueOnce(history),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ExecutionController],
      providers: [
        { provide: CommandBus, useValue: commandBus },
        { provide: QueryBus, useValue: queryBus },
        {
          provide: ExecutionEventPublisher,
          useValue: {
            publish: jest.fn().mockResolvedValue(undefined),
            subscribe: jest.fn().mockReturnValue(() => undefined),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context
            .switchToHttp()
            .getRequest<{ user: { id: string; email: string } }>();
          request.user = { id: 'actor-1', email: 'actor@example.test' };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a manual execution with 202 and returns its queued resource', async () => {
    await request(getServer())
      .post('/api/executions')
      .set('Idempotency-Key', 'intent-1')
      .send({ workflow_version_id: 'version-1' })
      .expect(202)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true, data: execution });
      });
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowVersionId: 'version-1',
        actorId: 'actor-1',
        idempotencyKey: 'intent-1',
      }),
    );
  });

  it('returns the current execution resource for polling', async () => {
    await request(getServer())
      .get('/api/executions/execution-1')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true, data: execution });
      });
  });

  it('lists recent executions for a workflow and version', async () => {
    await request(getServer())
      .get('/api/executions')
      .query({ workflow_id: 'workflow-1', workflow_version_id: 'version-1' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true, data: history });
      });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { PackageRegistry } from '@app/apps';
import { CredentialVault } from '@app/connector/application/credential-vault';
import { TriggerRepository } from '@app/triggers/domain/trigger.repository';
import { WebhookDedupPort } from '@app/triggers/application/ports/webhook-dedup.port';
import { TestEventStore } from '@app/triggers/application/ports/test-event.store';
import { SessionAccessPort } from '@app/auth/application/session-access.port';
import {
  ReceiveWebhookCommand,
  ReceiveWebhookHandler,
} from '@app/triggers/application/commands/receive-webhook.command';
import { QuotaExceededException } from '@app/subscription';

describe('ReceiveWebhookHandler [SCENARIO-SUB-03], [SCENARIO-SUB-04]', () => {
  let handler: ReceiveWebhookHandler;
  let registry: jest.Mocked<PackageRegistry>;
  let repository: jest.Mocked<TriggerRepository>;
  let vault: jest.Mocked<CredentialVault>;
  let dedup: jest.Mocked<WebhookDedupPort>;
  let tests: jest.Mocked<TestEventStore>;
  let commandBus: jest.Mocked<CommandBus>;
  let access: jest.Mocked<SessionAccessPort>;

  beforeEach(async () => {
    registry = {
      trigger: jest.fn().mockReturnValue({
        webhook: {
          scope: 'node',
          handle: jest.fn().mockResolvedValue({
            status: 200,
            events: [{ id: 'evt-1', json: { hello: 'world' } }],
          }),
          accepts: jest.fn().mockReturnValue(true),
        },
      }),
    } as any;

    repository = {
      findEndpoint: jest.fn().mockResolvedValue({
        id: 'ep-1',
        nodeKey: 'webhook-node',
        ownerId: 'owner-1',
      }),
      listenersOfEndpoint: jest.fn().mockResolvedValue([
        {
          id: 'listener-1',
          workflowId: 'wf-1',
          workflowVersionId: 'wv-1',
          parameters: {},
        },
      ]),
      findWorkflow: jest.fn().mockResolvedValue({
        id: 'wf-1',
        ownerId: 'owner-1',
      }),
    } as any;

    vault = {
      findOwned: jest.fn(),
    } as any;

    dedup = {
      claim: jest.fn().mockResolvedValue(true),
    } as any;

    tests = {
      waitingFor: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
    } as any;

    commandBus = {
      execute: jest.fn(),
    } as any;

    access = {
      isActive: jest.fn().mockResolvedValue(true),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiveWebhookHandler,
        { provide: PackageRegistry, useValue: registry },
        { provide: TriggerRepository, useValue: repository },
        { provide: CredentialVault, useValue: vault },
        { provide: WebhookDedupPort, useValue: dedup },
        { provide: TestEventStore, useValue: tests },
        { provide: CommandBus, useValue: commandBus },
        { provide: SessionAccessPort, useValue: access },
      ],
    }).compile();

    handler = module.get<ReceiveWebhookHandler>(ReceiveWebhookHandler);
  });

  it('enqueues execution and returns 200 when workflow owner has remaining quota [SCENARIO-SUB-03]', async () => {
    commandBus.execute.mockResolvedValue('exec-1');

    const result = await handler.execute(
      new ReceiveWebhookCommand('ep-1', {
        method: 'POST',
        headers: {},
        query: {},
        body: { hello: 'world' },
        rawBody: Buffer.from('{"hello":"world"}'),
      }),
    );

    expect(result.outcome).toBe('handled');
    if (result.outcome === 'handled') {
      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        success: true,
        data: { started: ['exec-1'], ignored: 0 },
      });
    }
  });

  it('returns HTTP 429 when workflow owner execution quota is exhausted [SCENARIO-SUB-04]', async () => {
    commandBus.execute.mockRejectedValue(
      new QuotaExceededException(
        'Monthly execution quota exceeded. Please upgrade your plan.',
      ),
    );

    const result = await handler.execute(
      new ReceiveWebhookCommand('ep-1', {
        method: 'POST',
        headers: {},
        query: {},
        body: { hello: 'world' },
        rawBody: Buffer.from('{"hello":"world"}'),
      }),
    );

    expect(result.outcome).toBe('handled');
    if (result.outcome === 'handled') {
      expect(result.status).toBe(429);
      expect(result.body).toEqual(
        expect.objectContaining({
          error: 'QUOTA_EXCEEDED',
        }),
      );
    }
  });
});

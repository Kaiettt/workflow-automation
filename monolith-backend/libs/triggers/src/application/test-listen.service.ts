import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PackageRegistry } from '@app/apps';
import { TriggerRepository } from '../domain/trigger.repository';
import {
  newTestListenId,
  TEST_LISTEN_SECONDS,
  TestListen,
} from '../domain/trigger.types';
import { definitionNodes } from '../domain/definition-nodes';
import { ActivationService } from './activation.service';
import { EndpointRegistrar } from './endpoint-registrar';
import { isExpired, TestEventStore } from './ports/test-event.store';

export interface TestListenView {
  listenId: string;
  status: 'waiting' | 'received' | 'expired';
  event: Record<string, unknown> | null;
  expiresAt: string;
}

// How often endpoints left registered by an expired test are unregistered.
const SWEEP_INTERVAL_MS = 60_000;

// "Listen for test event": one real event for a trigger node of the draft,
// shown in the designer and never executed.
@Injectable()
export class TestListenService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private sweeper: NodeJS.Timeout | null = null;

  constructor(
    private readonly registry: PackageRegistry,
    private readonly repository: TriggerRepository,
    private readonly registrar: EndpointRegistrar,
    private readonly activation: ActivationService,
    private readonly store: TestEventStore,
  ) {}

  async start(
    workflowId: string,
    nodeId: string,
    userId: string,
  ): Promise<TestListenView> {
    const workflow = await this.activation.ownedWorkflow(workflowId, userId);
    const definition = await this.repository.findDraftDefinition(workflow.id);
    const node = definitionNodes(definition).find((n) => n.id === nodeId);
    if (!node) {
      throw new NotFoundException(
        'Node not found in the saved draft. Wait for the draft to save and try again.',
      );
    }
    const trigger = this.registry.trigger(node.key);
    if (!trigger) {
      throw new BadRequestException('This node does not receive events');
    }

    const prepared = await this.registrar.prepare(
      trigger,
      node,
      workflow.id,
      workflow.ownerId,
    );
    const listen: TestListen = {
      id: newTestListenId(),
      userId,
      workflowId: workflow.id,
      nodeId,
      endpointId: prepared.endpoint.id,
      nodeKey: trigger.key,
      parameters: prepared.parameters,
      status: 'waiting',
      event: null,
      expiresAt: new Date(
        Date.now() + TEST_LISTEN_SECONDS * 1000,
      ).toISOString(),
    };
    // Saved first: the app may call the endpoint while it is registered.
    await this.store.save(listen);
    try {
      const others = (
        await this.repository.listenersOfEndpoint(prepared.endpoint.id)
      ).map((listener) => listener.parameters);
      await this.registrar.register(prepared, [...others, prepared.parameters]);
    } catch (error) {
      await this.store.remove(listen.id);
      await this.registrar.cleanup(prepared.endpoint.id);
      throw error;
    }

    // Once the test expires, sweep() unregisters an endpoint only it used.
    return viewOf(listen);
  }

  async get(listenId: string, userId: string): Promise<TestListenView> {
    return viewOf(await this.owned(listenId, userId));
  }

  async stop(listenId: string, userId: string): Promise<void> {
    const listen = await this.owned(listenId, userId);
    await this.store.remove(listen.id);
    await this.registrar.cleanup(listen.endpointId);
  }

  private async owned(listenId: string, userId: string) {
    const listen = await this.store.get(listenId);
    if (!listen || listen.userId !== userId) {
      throw new NotFoundException('Test listen not found');
    }
    return listen;
  }

  // Unregisters every endpoint nobody listens on any more (cleanup() keeps
  // the ones with a listener or a waiting test). Runs at startup and every
  // minute, so a test that expired, even across a restart, never leaves its
  // webhook registered with the app.
  async sweep(): Promise<void> {
    for (const endpointId of await this.repository.registeredEndpointIds()) {
      await this.registrar.cleanup(endpointId);
    }
  }

  onApplicationBootstrap() {
    const run = () => void this.sweep().catch(() => undefined);
    run();
    this.sweeper = setInterval(run, SWEEP_INTERVAL_MS);
    this.sweeper.unref?.();
  }

  onModuleDestroy() {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
  }
}

function viewOf(listen: TestListen): TestListenView {
  return {
    listenId: listen.id,
    status:
      listen.status === 'received'
        ? 'received'
        : isExpired(listen)
          ? 'expired'
          : 'waiting',
    event: listen.event,
    expiresAt: listen.expiresAt,
  };
}

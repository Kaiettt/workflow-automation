import {
  BadRequestException,
  Injectable,
  NotFoundException,
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

// "Listen for test event": one real event for a trigger node of the draft,
// shown in the designer and never executed.
@Injectable()
export class TestListenService implements OnModuleDestroy {
  private readonly timers = new Set<NodeJS.Timeout>();

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

    // Unregister an endpoint that only existed for this test.
    const timer = setTimeout(
      () => {
        this.timers.delete(timer);
        void this.registrar.cleanup(listen.endpointId);
      },
      TEST_LISTEN_SECONDS * 1000 + 1000,
    );
    timer.unref?.();
    this.timers.add(timer);

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

  onModuleDestroy() {
    for (const timer of this.timers) clearTimeout(timer);
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

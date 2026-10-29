import { Injectable } from '@nestjs/common';
import { Prisma, WebhookEndpoint as EndpointRow } from '@prisma/client';
import { WorkflowTrigger as ListenerRow } from '@prisma/client';
import { PrismaService } from '@app/database';
import { TriggerRepository } from '../domain/trigger.repository';
import {
  Listener,
  NewListener,
  NewWebhookEndpoint,
  WebhookEndpoint,
  WorkflowRef,
} from '../domain/trigger.types';

const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const asRecord = (value: Prisma.JsonValue): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value
    : {};

const toEndpoint = (row: EndpointRow): WebhookEndpoint => ({
  id: row.id,
  scopeKey: row.scopeKey,
  nodeKey: row.nodeKey,
  workflowId: row.workflowId,
  credentialId: row.credentialId,
  ownerId: row.ownerId,
  data: asRecord(row.data),
  registered: row.registered,
});

const toListener = (row: ListenerRow): Listener => ({
  id: row.id,
  workflowId: row.workflowId,
  workflowVersionId: row.workflowVersionId,
  nodeId: row.nodeId,
  nodeKey: row.nodeKey,
  endpointId: row.endpointId,
  credentialId: row.credentialId,
  parameters: asRecord(row.parameters),
});

@Injectable()
export class PrismaTriggerRepository implements TriggerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findWorkflow(workflowId: string): Promise<WorkflowRef | null> {
    if (!UUID_PATTERN.test(workflowId)) return null;
    const row = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        active: true,
        currentVersionId: true,
      },
    });
    return row;
  }

  async findVersionDefinition(versionId: string): Promise<unknown> {
    const row = await this.prisma.workflowVersion.findUnique({
      where: { id: versionId },
      select: { definition: true },
    });
    return row?.definition ?? null;
  }

  async findDraftDefinition(workflowId: string): Promise<unknown> {
    const row = await this.prisma.workflowDraft.findUnique({
      where: { workflowId },
      select: { definition: true },
    });
    return row?.definition ?? null;
  }

  async setActive(workflowId: string, active: boolean): Promise<void> {
    await this.prisma.workflow.update({
      where: { id: workflowId },
      data: { active },
    });
  }

  async findEndpoint(endpointId: string): Promise<WebhookEndpoint | null> {
    if (!UUID_PATTERN.test(endpointId)) return null;
    const row = await this.prisma.webhookEndpoint.findUnique({
      where: { id: endpointId },
    });
    return row ? toEndpoint(row) : null;
  }

  async findEndpointByScope(scopeKey: string): Promise<WebhookEndpoint | null> {
    const row = await this.prisma.webhookEndpoint.findUnique({
      where: { scopeKey },
    });
    return row ? toEndpoint(row) : null;
  }

  async createEndpoint(endpoint: NewWebhookEndpoint): Promise<WebhookEndpoint> {
    // Two requests may create the same scope at once: the second keeps the
    // first one's row (and URL).
    const row = await this.prisma.webhookEndpoint.upsert({
      where: { scopeKey: endpoint.scopeKey },
      update: {},
      create: {
        scopeKey: endpoint.scopeKey,
        nodeKey: endpoint.nodeKey,
        workflowId: endpoint.workflowId,
        credentialId: endpoint.credentialId,
        ownerId: endpoint.ownerId,
        data: endpoint.data as Prisma.InputJsonObject,
      },
    });
    return toEndpoint(row);
  }

  async updateEndpoint(
    endpointId: string,
    changes: { data: Record<string, unknown>; registered: boolean },
  ): Promise<void> {
    await this.prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: {
        data: changes.data as Prisma.InputJsonObject,
        registered: changes.registered,
      },
    });
  }

  async listenersOfEndpoint(endpointId: string): Promise<Listener[]> {
    const rows = await this.prisma.workflowTrigger.findMany({
      where: { endpointId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toListener);
  }

  async listenersOfWorkflow(workflowId: string): Promise<Listener[]> {
    const rows = await this.prisma.workflowTrigger.findMany({
      where: { workflowId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toListener);
  }

  async replaceListeners(
    workflowId: string,
    workflowVersionId: string | null,
    listeners: NewListener[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.workflowTrigger.deleteMany({ where: { workflowId } }),
      ...(workflowVersionId && listeners.length > 0
        ? [
            this.prisma.workflowTrigger.createMany({
              data: listeners.map((listener) => ({
                workflowId,
                workflowVersionId,
                nodeId: listener.nodeId,
                nodeKey: listener.nodeKey,
                endpointId: listener.endpointId,
                credentialId: listener.credentialId,
                parameters: listener.parameters as Prisma.InputJsonObject,
              })),
            }),
          ]
        : []),
    ]);
  }
}

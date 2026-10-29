// In-memory fakes for the triggers / integrations specs.
import { randomUUID } from 'node:crypto';
import { PackageRegistry } from '@app/apps';
import { createPackages } from '@app/apps/packages';
import type {
  CredentialVault,
  StoredCredential,
} from '@app/connector/application/credential-vault';
import { TriggerRepository } from '@app/triggers/domain/trigger.repository';
import {
  Listener,
  NewListener,
  NewWebhookEndpoint,
  TestListen,
  WebhookEndpoint,
  WorkflowRef,
} from '@app/triggers/domain/trigger.types';
import { WebhookDedupPort } from '@app/triggers/application/ports/webhook-dedup.port';
import {
  isExpired,
  TestEventStore,
} from '@app/triggers/application/ports/test-event.store';
import { FakeMetaGraph } from '@test/support/apps/fake-meta-graph';

export const OWNER = 'owner-1';
export const MESSENGER_CREDENTIAL_ID = '55555555-5555-5555-5555-555555555551';
export const LLM_CREDENTIAL_ID = '55555555-5555-5555-5555-555555555553';

export const testRegistry = (graph = new FakeMetaGraph()) =>
  new PackageRegistry(createPackages({ metaGraph: graph }));

// A Messenger credential already connected with OAuth2.
export const messengerSecret = () => ({
  client_id: 'app-1',
  client_secret: 'app-secret',
  access_token: 'EAAuser',
  pages: [
    { id: 'page-1', name: 'Shop ABC', access_token: 'EAApage1' },
    { id: 'page-2', name: 'Shop XYZ', access_token: 'EAApage2' },
  ],
});

export class MemoryVault {
  credentials = new Map<string, StoredCredential>([
    [
      MESSENGER_CREDENTIAL_ID,
      {
        id: MESSENGER_CREDENTIAL_ID,
        ownerId: OWNER,
        name: 'Shop app',
        connectorKey: 'facebookMessengerOAuth2',
        secret: messengerSecret(),
      },
    ],
    [
      LLM_CREDENTIAL_ID,
      {
        id: LLM_CREDENTIAL_ID,
        ownerId: OWNER,
        name: 'OpenAI',
        connectorKey: 'openai',
        secret: { api_key: 'k' },
      },
    ],
  ]);

  find(credentialId: unknown) {
    return Promise.resolve(
      typeof credentialId === 'string'
        ? (this.credentials.get(credentialId) ?? null)
        : null,
    );
  }

  async findOwned(credentialId: unknown, ownerId: string) {
    const credential = await this.find(credentialId);
    return credential?.ownerId === ownerId ? credential : null;
  }

  updateSecret(credentialId: string, secret: Record<string, unknown>) {
    const credential = this.credentials.get(credentialId);
    if (credential) credential.secret = secret;
    return Promise.resolve();
  }

  asVault(): CredentialVault {
    return this as unknown as CredentialVault;
  }
}

export class MemoryTriggerRepository extends TriggerRepository {
  workflows = new Map<string, WorkflowRef>();
  versions = new Map<string, unknown>();
  drafts = new Map<string, unknown>();
  endpoints: WebhookEndpoint[] = [];
  listeners: Listener[] = [];

  addWorkflow(
    id: string,
    definition: unknown,
    options: { published?: boolean; active?: boolean; ownerId?: string } = {},
  ) {
    const versionId = options.published === false ? null : `${id}-v1`;
    this.workflows.set(id, {
      id,
      name: `Workflow ${id}`,
      ownerId: options.ownerId ?? OWNER,
      active: options.active ?? false,
      currentVersionId: versionId,
    });
    if (versionId) this.versions.set(versionId, definition);
    this.drafts.set(id, definition);
  }

  // A new version becomes current (as a publish does).
  publish(id: string, definition: unknown) {
    const workflow = this.workflows.get(id)!;
    const versionId = `${id}-v${this.versions.size + 1}`;
    this.versions.set(versionId, definition);
    this.drafts.set(id, definition);
    workflow.currentVersionId = versionId;
  }

  findWorkflow(workflowId: string) {
    const workflow = this.workflows.get(workflowId);
    return Promise.resolve(workflow ? { ...workflow } : null);
  }

  findVersionDefinition(versionId: string) {
    return Promise.resolve(this.versions.get(versionId) ?? null);
  }

  findDraftDefinition(workflowId: string) {
    return Promise.resolve(this.drafts.get(workflowId) ?? null);
  }

  setActive(workflowId: string, active: boolean) {
    this.workflows.get(workflowId)!.active = active;
    return Promise.resolve();
  }

  findEndpoint(endpointId: string) {
    const endpoint = this.endpoints.find((e) => e.id === endpointId);
    return Promise.resolve(endpoint ? clone(endpoint) : null);
  }

  findEndpointByScope(scopeKey: string) {
    const endpoint = this.endpoints.find((e) => e.scopeKey === scopeKey);
    return Promise.resolve(endpoint ? clone(endpoint) : null);
  }

  createEndpoint(endpoint: NewWebhookEndpoint) {
    const created: WebhookEndpoint = {
      ...endpoint,
      id: randomUUID(),
      registered: false,
    };
    this.endpoints.push(created);
    return Promise.resolve(clone(created));
  }

  updateEndpoint(
    endpointId: string,
    changes: { data: Record<string, unknown>; registered: boolean },
  ) {
    const endpoint = this.endpoints.find((e) => e.id === endpointId)!;
    endpoint.data = clone(changes.data);
    endpoint.registered = changes.registered;
    return Promise.resolve();
  }

  listenersOfEndpoint(endpointId: string) {
    return Promise.resolve(
      this.listeners.filter((l) => l.endpointId === endpointId),
    );
  }

  listenersOfWorkflow(workflowId: string) {
    return Promise.resolve(
      this.listeners.filter((l) => l.workflowId === workflowId),
    );
  }

  replaceListeners(
    workflowId: string,
    workflowVersionId: string | null,
    listeners: NewListener[],
  ) {
    this.listeners = this.listeners.filter((l) => l.workflowId !== workflowId);
    if (workflowVersionId) {
      for (const listener of listeners) {
        this.listeners.push({
          ...listener,
          id: randomUUID(),
          workflowId,
          workflowVersionId,
        });
      }
    }
    return Promise.resolve();
  }

  endpointOf(scopeKey: string) {
    return this.endpoints.find((e) => e.scopeKey === scopeKey);
  }
}

export class MemoryTestEventStore extends TestEventStore {
  listens = new Map<string, TestListen>();

  save(listen: TestListen) {
    this.listens.set(listen.id, clone(listen));
    return Promise.resolve();
  }

  get(listenId: string) {
    const listen = this.listens.get(listenId);
    return Promise.resolve(listen ? clone(listen) : null);
  }

  waitingFor(endpointId: string) {
    return Promise.resolve(
      [...this.listens.values()].filter(
        (l) =>
          l.endpointId === endpointId &&
          l.status === 'waiting' &&
          !isExpired(l),
      ),
    );
  }

  remove(listenId: string) {
    this.listens.delete(listenId);
    return Promise.resolve();
  }
}

export class MemoryDedup extends WebhookDedupPort {
  seen = new Set<string>();
  claim(key: string) {
    if (this.seen.has(key)) return Promise.resolve(false);
    this.seen.add(key);
    return Promise.resolve(true);
  }
}

// Definitions made of package nodes.
export const node = (
  id: string,
  key: string,
  config: Record<string, unknown> = {},
  name = id,
) => ({ id, type: 'triggerNode', data: { key, name, config } });

export const definition = (...nodes: unknown[]) => ({ nodes, edges: [] });

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

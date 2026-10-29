import {
  Listener,
  NewListener,
  NewWebhookEndpoint,
  WebhookEndpoint,
  WorkflowRef,
} from './trigger.types';

export abstract class TriggerRepository {
  abstract findWorkflow(workflowId: string): Promise<WorkflowRef | null>;
  abstract findVersionDefinition(versionId: string): Promise<unknown>;
  abstract findDraftDefinition(workflowId: string): Promise<unknown>;
  abstract setActive(workflowId: string, active: boolean): Promise<void>;

  abstract findEndpoint(endpointId: string): Promise<WebhookEndpoint | null>;
  abstract findEndpointByScope(
    scopeKey: string,
  ): Promise<WebhookEndpoint | null>;
  // Returns the existing endpoint when another request created it first.
  abstract createEndpoint(
    endpoint: NewWebhookEndpoint,
  ): Promise<WebhookEndpoint>;
  abstract updateEndpoint(
    endpointId: string,
    changes: { data: Record<string, unknown>; registered: boolean },
  ): Promise<void>;

  abstract listenersOfEndpoint(endpointId: string): Promise<Listener[]>;
  abstract listenersOfWorkflow(workflowId: string): Promise<Listener[]>;
  // In one transaction: the workflow's listeners become exactly these.
  abstract replaceListeners(
    workflowId: string,
    workflowVersionId: string | null,
    listeners: NewListener[],
  ): Promise<void>;
}

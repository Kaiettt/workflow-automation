// In-memory fakes for the triggers module specs.
import {
  NewWorkflowTrigger,
  TriggerChannel,
  WorkflowTrigger,
} from '@app/triggers/domain/workflow-trigger';
import {
  StoredCredential,
  WorkflowTriggerRepository,
} from '@app/triggers/domain/workflow-trigger.repository';
import { WebhookDedupPort } from '@app/triggers/application/ports/webhook-dedup.port';

export const PAGE_CREDENTIAL_ID = '55555555-5555-5555-5555-555555555551';
export const OTHER_PAGE_CREDENTIAL_ID = '55555555-5555-5555-5555-555555555552';
export const LLM_CREDENTIAL_ID = '55555555-5555-5555-5555-555555555553';

export class MemoryTriggerRepository extends WorkflowTriggerRepository {
  rows: WorkflowTrigger[] = [];
  owner: string | null = 'owner-1';
  workflowNames = new Map<string, string>([['wf-other', 'Other workflow']]);
  // Credentials of owner-1, by id.
  credentials = new Map<string, StoredCredential>([
    [
      PAGE_CREDENTIAL_ID,
      {
        connectorKey: 'messenger',
        secret: { page_id: 'page-1', page_access_token: 'EAAtoken' },
      },
    ],
    [
      OTHER_PAGE_CREDENTIAL_ID,
      {
        connectorKey: 'messenger',
        secret: { page_id: 'page-2', page_access_token: 'EAAtoken2' },
      },
    ],
    [LLM_CREDENTIAL_ID, { connectorKey: 'openai', secret: { api_key: 'k' } }],
  ]);
  private seq = 0;

  findActive(channel: TriggerChannel, routingKey: string) {
    return Promise.resolve(
      this.rows.find(
        (r) =>
          r.channel === channel && r.routingKey === routingKey && r.isActive,
      ) ?? null,
    );
  }

  findByWorkflow(workflowId: string) {
    return Promise.resolve(
      this.rows.filter((r) => r.workflowId === workflowId),
    );
  }

  replaceActive(
    workflowId: string,
    workflowVersionId: string,
    triggers: NewWorkflowTrigger[],
  ) {
    for (const row of this.rows) {
      if (row.workflowId === workflowId) row.isActive = false;
    }
    for (const trigger of triggers) {
      this.seq += 1;
      this.rows.push({
        ...trigger,
        id: `trigger-${this.seq}`,
        workflowId,
        workflowVersionId,
        isActive: true,
        createdAt: new Date(Date.UTC(2026, 9, 29, 0, 0, this.seq)),
      });
    }
    return Promise.resolve();
  }

  findWorkflowOwnerId() {
    return Promise.resolve(this.owner);
  }

  findWorkflowName(workflowId: string) {
    return Promise.resolve(this.workflowNames.get(workflowId) ?? null);
  }

  findCredential(credentialId: string, ownerId: string) {
    return Promise.resolve(
      ownerId === 'owner-1'
        ? (this.credentials.get(credentialId) ?? null)
        : null,
    );
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

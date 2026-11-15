import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  ChangeConnectorPolicyParams,
  ConnectorPolicyPort,
  ConnectorPolicySnapshot,
} from '@app/connector/application/ports/connector-policy.port';

export interface RecordedConnectorAuditEvent {
  actorId: string;
  action: string;
  targetId: string;
  reason: string;
  before: { allowNewCredentials: boolean; revision: number };
  after: { allowNewCredentials: boolean; revision: number };
}

export class InMemoryConnectorPolicyRepository extends ConnectorPolicyPort {
  policies = new Map<
    string,
    { allowNewCredentials: boolean; revision: number; updatedAt: Date }
  >();
  auditEvents: RecordedConnectorAuditEvent[] = [];

  setPolicy(
    connectorId: string,
    allowNewCredentials: boolean,
    revision = 0,
    updatedAt = new Date(),
  ): void {
    this.policies.set(connectorId, {
      allowNewCredentials,
      revision,
      updatedAt,
    });
  }

  getPolicy(connectorId: string): Promise<ConnectorPolicySnapshot> {
    const existing = this.policies.get(connectorId);
    if (!existing) {
      return Promise.resolve({
        connectorId,
        allowNewCredentials: true,
        revision: 0,
        updatedAt: new Date(),
      });
    }
    return Promise.resolve({
      connectorId,
      allowNewCredentials: existing.allowNewCredentials,
      revision: existing.revision,
      updatedAt: existing.updatedAt,
    });
  }

  async assertCanCreateCredential(connectorId: string): Promise<void> {
    const policy = await this.getPolicy(connectorId);
    if (!policy.allowNewCredentials) {
      throw new ConflictException({
        code: 'CONNECTOR_NEW_CREDENTIALS_DISABLED',
        message:
          'New credentials for this connector have been disabled by platform administrator',
      });
    }
  }

  async changePolicy(
    params: ChangeConnectorPolicyParams,
  ): Promise<ConnectorPolicySnapshot> {
    const reason = params.reason?.trim();
    if (!reason || reason.length < 5 || reason.length > 500) {
      throw new BadRequestException('Reason must contain 5–500 characters');
    }

    const current = await this.getPolicy(params.connectorId);
    if (current.revision !== params.expectedRevision) {
      throw new ConflictException({
        code: 'STALE_REVISION',
        message: `Policy changed; reload before continuing`,
      });
    }

    if (current.allowNewCredentials === params.allowNewCredentials) {
      return current;
    }

    const nextRevision = current.revision + 1;
    const updatedAt = new Date();
    this.policies.set(params.connectorId, {
      allowNewCredentials: params.allowNewCredentials,
      revision: nextRevision,
      updatedAt,
    });

    this.auditEvents.push({
      actorId: params.adminId,
      action: 'CONNECTOR_POLICY_CHANGED',
      targetId: params.connectorId,
      reason,
      before: {
        allowNewCredentials: current.allowNewCredentials,
        revision: current.revision,
      },
      after: {
        allowNewCredentials: params.allowNewCredentials,
        revision: nextRevision,
      },
    });

    return {
      connectorId: params.connectorId,
      allowNewCredentials: params.allowNewCredentials,
      revision: nextRevision,
      updatedAt,
    };
  }
}

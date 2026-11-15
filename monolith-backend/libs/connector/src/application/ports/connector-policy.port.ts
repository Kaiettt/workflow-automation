export interface ConnectorPolicySnapshot {
  connectorId: string;
  allowNewCredentials: boolean;
  revision: number;
  updatedAt: Date;
}

export interface ChangeConnectorPolicyParams {
  connectorId: string;
  allowNewCredentials: boolean;
  reason: string;
  expectedRevision: number;
  adminId: string;
}

export abstract class ConnectorPolicyPort {
  abstract getPolicy(connectorId: string): Promise<ConnectorPolicySnapshot>;
  abstract assertCanCreateCredential(connectorId: string): Promise<void>;
  abstract changePolicy(
    params: ChangeConnectorPolicyParams,
  ): Promise<ConnectorPolicySnapshot>;
}

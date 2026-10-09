import { ConnectorTestStatus } from '../enums/connector-test-status.enum';

export class ConnectorCredential {
  constructor(
    public readonly id: string | undefined,
    public readonly connectorId: string,
    public readonly ownerId: string,
    public readonly name: string,
    public readonly encryptedSecret: string,
    public readonly lastTestedAt?: Date | null,
    public readonly lastTestStatus?: ConnectorTestStatus,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
  ) {}
}

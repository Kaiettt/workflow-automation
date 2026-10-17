import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ConnectorRepository } from '../../domain/repositories/connector.repository';
import { ConnectorCredentialRepository } from '../../domain/repositories/connector-credential.repository';
import { CredentialSummary } from '../dtos/credential-summary.dto';

export class ListCredentialsQuery {
  constructor(
    readonly connectorKey: string,
    readonly ownerId: string,
  ) {}
}

@QueryHandler(ListCredentialsQuery)
export class ListCredentialsHandler implements IQueryHandler<ListCredentialsQuery> {
  constructor(
    private readonly connectorRepo: ConnectorRepository,
    private readonly credentialRepo: ConnectorCredentialRepository,
  ) {}

  async execute(query: ListCredentialsQuery): Promise<CredentialSummary[]> {
    const connector = await this.connectorRepo.findByKey(query.connectorKey);
    if (!connector || !connector.isActive) {
      throw new NotFoundException(
        `Connector "${query.connectorKey}" was not found`,
      );
    }

    const credentials = await this.credentialRepo.findByOwnerAndConnector(
      query.ownerId,
      connector.id,
    );
    return credentials.map((credential) => ({
      id: credential.id!,
      connectorKey: connector.key,
      name: credential.name,
      createdAt: credential.createdAt!,
    }));
  }
}

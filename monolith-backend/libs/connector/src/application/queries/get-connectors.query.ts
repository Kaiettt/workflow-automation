import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ConnectorRepository } from '../../domain/repositories/connector.repository';
import { Connector } from '../../domain/entities/connector.entity';

export class GetConnectorsQuery {
  constructor() {}
}

@QueryHandler(GetConnectorsQuery)
export class GetConnectorsHandler implements IQueryHandler<GetConnectorsQuery> {
  constructor(private readonly connectorRepo: ConnectorRepository) {}

  async execute(query: GetConnectorsQuery): Promise<Connector[]> {
    void query;
    return this.connectorRepo.findAllActive();
  }
}

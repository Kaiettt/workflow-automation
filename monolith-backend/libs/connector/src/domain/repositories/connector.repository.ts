import { Connector } from '../entities/connector.entity';

export abstract class ConnectorRepository {
  abstract findAllActive(): Promise<Connector[]>;
  abstract findByKey(key: string): Promise<Connector | null>;
}

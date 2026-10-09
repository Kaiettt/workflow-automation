import { ConnectorCredential } from '../entities/connector-credential.entity';

export abstract class ConnectorCredentialRepository {
  abstract save(credential: ConnectorCredential): Promise<void>;
  abstract create(credential: ConnectorCredential): Promise<ConnectorCredential>;
}

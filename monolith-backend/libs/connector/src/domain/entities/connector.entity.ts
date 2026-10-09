import { ConnectorAuthType } from '../enums/connector-auth-type.enum';

export class Connector {
  constructor(
    public readonly id: string,
    public readonly key: string,
    public readonly name: string,
    public readonly authType: ConnectorAuthType,
    public readonly configSchema: any,
    public readonly isActive: boolean,
    public readonly createdAt?: Date,
  ) {}
}

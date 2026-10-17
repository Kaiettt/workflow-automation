import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EncryptionUtil } from '@app/shared/utils/encryption.util';
import { ConnectorRepository } from '../../domain/repositories/connector.repository';
import { ConnectorCredentialRepository } from '../../domain/repositories/connector-credential.repository';
import { ConnectorCredential } from '../../domain/entities/connector-credential.entity';
import { ConnectorAuthType } from '../../domain/enums/connector-auth-type.enum';
import { CredentialSummary } from '../dtos/credential-summary.dto';

export class CreateApiKeyCredentialCommand {
  constructor(
    readonly connectorKey: string,
    readonly ownerId: string,
    readonly name: string,
    readonly apiKey: string,
  ) {}
}

@CommandHandler(CreateApiKeyCredentialCommand)
export class CreateApiKeyCredentialHandler implements ICommandHandler<CreateApiKeyCredentialCommand> {
  constructor(
    private readonly connectorRepo: ConnectorRepository,
    private readonly credentialRepo: ConnectorCredentialRepository,
  ) {}

  async execute(
    command: CreateApiKeyCredentialCommand,
  ): Promise<CredentialSummary> {
    const connector = await this.connectorRepo.findByKey(command.connectorKey);
    if (!connector || !connector.isActive) {
      throw new NotFoundException(
        `Connector "${command.connectorKey}" was not found`,
      );
    }
    if (connector.authType !== ConnectorAuthType.API_KEY) {
      throw new BadRequestException(
        `Connector "${connector.key}" does not use an API key`,
      );
    }

    const name = command.name.trim();
    const apiKey = command.apiKey.trim();
    if (!name || !apiKey) {
      throw new BadRequestException('name and api_key must not be blank');
    }

    const encryptionKey = process.env['ENCRYPTION_KEY'];
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY is not defined');
    }

    const saved = await this.credentialRepo.create(
      new ConnectorCredential(
        undefined,
        connector.id,
        command.ownerId,
        name,
        EncryptionUtil.encrypt(
          JSON.stringify({ api_key: apiKey }),
          encryptionKey,
        ),
      ),
    );

    return {
      id: saved.id!,
      connectorKey: connector.key,
      name: saved.name,
      createdAt: saved.createdAt!,
    };
  }
}

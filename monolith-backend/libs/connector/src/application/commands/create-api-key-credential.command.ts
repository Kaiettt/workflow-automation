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
    // The fields of the connector's config_schema (e.g. page_id +
    // page_access_token); a plain string is the api_key of single-key connectors.
    readonly secret: string | Record<string, unknown>,
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
    // OAuth2 credential types of integration packages start from a form too
    // (App ID / App Secret); their tokens are added by the OAuth2 callback.
    const isPackageOAuth2 =
      connector.authType === ConnectorAuthType.OAUTH2 &&
      (connector.configSchema as { 'x-oauth2'?: unknown } | null)?.[
        'x-oauth2'
      ] === true;
    if (connector.authType !== ConnectorAuthType.API_KEY && !isPackageOAuth2) {
      throw new BadRequestException(
        `Connector "${connector.key}" is not created from a form`,
      );
    }

    const name = command.name.trim();
    if (!name) throw new BadRequestException('name must not be blank');
    const secret = secretFields(
      connector.configSchema,
      typeof command.secret === 'string'
        ? { api_key: command.secret }
        : command.secret,
    );

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
        EncryptionUtil.encrypt(JSON.stringify(secret), encryptionKey),
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

// Keeps the fields the connector declares, trimmed; every required one must be
// a non-blank string. A connector declaring nothing takes a single api_key.
function secretFields(
  configSchema: unknown,
  values: Record<string, unknown>,
): Record<string, string> {
  const schema = (configSchema ?? {}) as {
    required?: unknown;
    properties?: Record<string, unknown>;
  };
  const declared = Array.isArray(schema.required)
    ? schema.required.filter(
        (field): field is string => typeof field === 'string',
      )
    : [];
  const required =
    declared.length === 0 && Object.keys(schema.properties ?? {}).length === 0
      ? ['api_key']
      : declared;
  const known = new Set([...Object.keys(schema.properties ?? {}), ...required]);

  const secret: Record<string, string> = {};
  for (const field of known) {
    const value = values[field];
    if (typeof value === 'string' && value.trim() !== '') {
      secret[field] = value.trim();
    }
  }
  const missing = required.filter((field) => !(field in secret));
  if (missing.length > 0) {
    throw new BadRequestException(`${missing.join(', ')} must not be blank`);
  }
  return secret;
}

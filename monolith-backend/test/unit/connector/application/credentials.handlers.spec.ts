import { BadRequestException, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { EncryptionUtil } from '@app/shared/utils/encryption.util';
import { Connector } from '@app/connector/domain/entities/connector.entity';
import { ConnectorCredential } from '@app/connector/domain/entities/connector-credential.entity';
import { ConnectorAuthType } from '@app/connector/domain/enums/connector-auth-type.enum';
import { ConnectorRepository } from '@app/connector/domain/repositories/connector.repository';
import { ConnectorCredentialRepository } from '@app/connector/domain/repositories/connector-credential.repository';
import {
  CreateApiKeyCredentialCommand,
  CreateApiKeyCredentialHandler,
} from '@app/connector/application/commands/create-api-key-credential.command';
import {
  ListCredentialsHandler,
  ListCredentialsQuery,
} from '@app/connector/application/queries/list-credentials.query';

const connectors = [
  new Connector(
    'c-openai',
    'openai',
    'OpenAI',
    ConnectorAuthType.API_KEY,
    {},
    true,
  ),
  new Connector('c-off', 'old', 'Old', ConnectorAuthType.API_KEY, {}, false),
  new Connector(
    'c-google',
    'google',
    'Google',
    ConnectorAuthType.OAUTH2,
    {},
    true,
  ),
];

class MemoryConnectorRepository extends ConnectorRepository {
  findAllActive(): Promise<Connector[]> {
    return Promise.resolve(connectors.filter((c) => c.isActive));
  }
  findByKey(key: string): Promise<Connector | null> {
    return Promise.resolve(connectors.find((c) => c.key === key) ?? null);
  }
}

class MemoryCredentialRepository extends ConnectorCredentialRepository {
  rows: ConnectorCredential[] = [];

  save(): Promise<void> {
    return Promise.resolve();
  }

  create(credential: ConnectorCredential): Promise<ConnectorCredential> {
    const saved = new ConnectorCredential(
      `cred-${this.rows.length + 1}`,
      credential.connectorId,
      credential.ownerId,
      credential.name,
      credential.encryptedSecret,
      null,
      undefined,
      new Date('2026-10-17T00:00:00Z'),
    );
    this.rows.push(saved);
    return Promise.resolve(saved);
  }

  findByOwnerAndConnector(
    ownerId: string,
    connectorId: string,
  ): Promise<ConnectorCredential[]> {
    return Promise.resolve(
      this.rows.filter(
        (row) => row.ownerId === ownerId && row.connectorId === connectorId,
      ),
    );
  }
}

describe('credential handlers', () => {
  const encryptionKey = randomBytes(32).toString('hex');
  let previousKey: string | undefined;
  let credentials: MemoryCredentialRepository;
  let create: CreateApiKeyCredentialHandler;
  let list: ListCredentialsHandler;

  beforeEach(() => {
    previousKey = process.env['ENCRYPTION_KEY'];
    process.env['ENCRYPTION_KEY'] = encryptionKey;
    credentials = new MemoryCredentialRepository();
    create = new CreateApiKeyCredentialHandler(
      new MemoryConnectorRepository(),
      credentials,
    );
    list = new ListCredentialsHandler(
      new MemoryConnectorRepository(),
      credentials,
    );
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env['ENCRYPTION_KEY'];
    else process.env['ENCRYPTION_KEY'] = previousKey;
  });

  describe('CreateApiKeyCredentialHandler', () => {
    it('stores the key encrypted and returns a summary without it', async () => {
      const summary = await create.execute(
        new CreateApiKeyCredentialCommand(
          'openai',
          'u1',
          ' My key ',
          ' sk-abc123 ',
        ),
      );

      expect(summary).toEqual({
        id: 'cred-1',
        connectorKey: 'openai',
        name: 'My key',
        createdAt: new Date('2026-10-17T00:00:00Z'),
      });
      expect(JSON.stringify(summary)).not.toContain('sk-abc123');

      const stored = credentials.rows[0];
      expect(stored.ownerId).toBe('u1');
      expect(stored.connectorId).toBe('c-openai');
      expect(stored.encryptedSecret).not.toContain('sk-abc123');
      expect(
        JSON.parse(
          EncryptionUtil.decrypt(stored.encryptedSecret, encryptionKey),
        ),
      ).toEqual({ api_key: 'sk-abc123' });
    });

    it('rejects an unknown or inactive connector', async () => {
      for (const key of ['nope', 'old']) {
        await expect(
          create.execute(
            new CreateApiKeyCredentialCommand(key, 'u1', 'n', 'k'),
          ),
        ).rejects.toThrow(NotFoundException);
      }
    });

    it('rejects a connector that does not use an API key', async () => {
      await expect(
        create.execute(
          new CreateApiKeyCredentialCommand('google', 'u1', 'n', 'k'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a blank name or key', async () => {
      await expect(
        create.execute(
          new CreateApiKeyCredentialCommand('openai', 'u1', '  ', 'k'),
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        create.execute(
          new CreateApiKeyCredentialCommand('openai', 'u1', 'n', '  '),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(credentials.rows).toHaveLength(0);
    });

    it('refuses to store a key when no encryption key is configured', async () => {
      delete process.env['ENCRYPTION_KEY'];
      await expect(
        create.execute(
          new CreateApiKeyCredentialCommand('openai', 'u1', 'n', 'k'),
        ),
      ).rejects.toThrow('ENCRYPTION_KEY');
      expect(credentials.rows).toHaveLength(0);
    });
  });

  describe('ListCredentialsHandler', () => {
    it("lists only the caller's credentials of that connector, with no secret", async () => {
      await create.execute(
        new CreateApiKeyCredentialCommand('openai', 'u1', 'mine', 'k1'),
      );
      await create.execute(
        new CreateApiKeyCredentialCommand('openai', 'u2', 'theirs', 'k2'),
      );

      const result = await list.execute(
        new ListCredentialsQuery('openai', 'u1'),
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ connectorKey: 'openai', name: 'mine' });
      expect(Object.keys(result[0]).sort()).toEqual([
        'connectorKey',
        'createdAt',
        'id',
        'name',
      ]);
    });

    it('returns an empty list when the user has none', async () => {
      expect(
        await list.execute(new ListCredentialsQuery('openai', 'u1')),
      ).toEqual([]);
    });

    it('rejects an unknown connector', async () => {
      await expect(
        list.execute(new ListCredentialsQuery('nope', 'u1')),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

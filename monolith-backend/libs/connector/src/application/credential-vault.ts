import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { EncryptionUtil } from '@app/shared/utils/encryption.util';

const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export interface StoredCredential {
  id: string;
  ownerId: string;
  name: string;
  connectorKey: string;
  secret: Record<string, unknown>;
}

// Decrypted credentials for code that runs on the user's behalf (activation,
// webhooks, OAuth2, dynamic options). Secrets never leave the server.
@Injectable()
export class CredentialVault {
  constructor(private readonly prisma: PrismaService) {}

  // The credential if it exists and belongs to `ownerId`, else null.
  async findOwned(
    credentialId: unknown,
    ownerId: string,
  ): Promise<StoredCredential | null> {
    const credential = await this.find(credentialId);
    return credential?.ownerId === ownerId ? credential : null;
  }

  async find(credentialId: unknown): Promise<StoredCredential | null> {
    // The column is a UUID: anything else would make the query itself fail.
    if (typeof credentialId !== 'string' || !UUID_PATTERN.test(credentialId)) {
      return null;
    }
    const row = await this.prisma.connectorCredential.findUnique({
      where: { id: credentialId },
      include: { connector: { select: { key: true } } },
    });
    if (!row) return null;
    return {
      id: row.id,
      ownerId: row.ownerId,
      name: row.name,
      connectorKey: row.connector.key,
      secret: JSON.parse(
        EncryptionUtil.decrypt(row.encryptedSecret, encryptionKey()),
      ) as Record<string, unknown>,
    };
  }

  async updateSecret(
    credentialId: string,
    secret: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.connectorCredential.update({
      where: { id: credentialId },
      data: {
        encryptedSecret: EncryptionUtil.encrypt(
          JSON.stringify(secret),
          encryptionKey(),
        ),
      },
    });
  }
}

function encryptionKey(): string {
  const key = process.env['ENCRYPTION_KEY'];
  if (!key) throw new Error('Credential encryption key is not configured');
  return key;
}

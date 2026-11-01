import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConnectorAuthType, NodeCategory } from '@prisma/client';
import { PrismaService } from '@app/database';
import {
  credentialConfigSchema,
  nodeConfigSchema,
  PackageRegistry,
} from '@app/apps';

// Integration packages are the source of truth for their node and credential
// types: they are written into the catalog every time the server starts, so a
// new package needs no seed change.
@Injectable()
export class PackageCatalogSync implements OnApplicationBootstrap {
  private readonly logger = new Logger(PackageCatalogSync.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PackageRegistry,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.sync();
  }

  async sync(): Promise<void> {
    const connectorIds = new Map<string, string>();
    for (const credential of this.registry.allCredentialTypes()) {
      const data = {
        name: credential.displayName,
        authType: credential.oauth2
          ? ConnectorAuthType.OAUTH2
          : ConnectorAuthType.API_KEY,
        configSchema: credentialConfigSchema(credential) as object,
        isActive: true,
      };
      const row = await this.prisma.connector.upsert({
        where: { key: credential.key },
        update: data,
        create: { key: credential.key, ...data },
      });
      connectorIds.set(credential.key, row.id);
    }

    const nodes = this.registry.allNodes();
    for (const node of nodes) {
      const data = {
        displayName: node.displayName,
        icon: node.icon,
        color: node.color,
        category:
          node.kind === 'trigger'
            ? NodeCategory.TRIGGER
            : NodeCategory.INTEGRATION,
        description: node.description,
        configSchema: nodeConfigSchema(node) as object,
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        connectorId: node.credentialType
          ? (connectorIds.get(node.credentialType) ?? null)
          : null,
        isActive: true,
      };
      await this.prisma.nodeTypeDefinition.upsert({
        where: { key: node.key },
        update: data,
        create: { key: node.key, ...data },
      });
    }
    this.logger.log(
      `Synced ${nodes.length} node types and ${connectorIds.size} credential types from ${this.registry.packages.length} packages`,
    );
  }
}

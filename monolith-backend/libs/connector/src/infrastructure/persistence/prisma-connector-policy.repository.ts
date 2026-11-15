import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/database';
import {
  ChangeConnectorPolicyParams,
  ConnectorPolicyPort,
  ConnectorPolicySnapshot,
} from '../../application/ports/connector-policy.port';

@Injectable()
export class PrismaConnectorPolicyRepository extends ConnectorPolicyPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async getPolicy(connectorId: string): Promise<ConnectorPolicySnapshot> {
    const policy = await this.prisma.connectorPolicy.findUnique({
      where: { connectorId },
    });
    if (!policy) {
      return {
        connectorId,
        allowNewCredentials: true,
        revision: 0,
        updatedAt: new Date(),
      };
    }
    return {
      connectorId: policy.connectorId,
      allowNewCredentials: policy.allowNewCredentials,
      revision: policy.revision,
      updatedAt: policy.updatedAt,
    };
  }

  async assertCanCreateCredential(connectorId: string): Promise<void> {
    const policy = await this.getPolicy(connectorId);
    if (!policy.allowNewCredentials) {
      throw new ConflictException({
        code: 'CONNECTOR_NEW_CREDENTIALS_DISABLED',
        message:
          'New credentials for this connector have been disabled by platform administrator',
      });
    }
  }

  async changePolicy(
    params: ChangeConnectorPolicyParams,
  ): Promise<ConnectorPolicySnapshot> {
    const reason = params.reason?.trim();
    if (!reason || reason.length < 5 || reason.length > 500) {
      throw new BadRequestException('Reason must contain 5–500 characters');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(7261102)::text`;

      const connector = await tx.connector.findUnique({
        where: { id: params.connectorId },
      });
      if (!connector) {
        throw new NotFoundException('Connector not found');
      }

      const current = await tx.connectorPolicy.findUnique({
        where: { connectorId: params.connectorId },
      });

      const currentAllow = current ? current.allowNewCredentials : true;
      const currentRevision = current ? current.revision : 0;

      if (currentRevision !== params.expectedRevision) {
        throw new ConflictException({
          code: 'STALE_REVISION',
          message: 'Policy changed; reload before continuing',
        });
      }

      if (currentAllow === params.allowNewCredentials) {
        return {
          connectorId: params.connectorId,
          allowNewCredentials: currentAllow,
          revision: currentRevision,
          updatedAt: current?.updatedAt ?? new Date(),
        };
      }

      const updated = await tx.connectorPolicy.upsert({
        where: { connectorId: params.connectorId },
        create: {
          connectorId: params.connectorId,
          allowNewCredentials: params.allowNewCredentials,
          revision: currentRevision + 1,
        },
        update: {
          allowNewCredentials: params.allowNewCredentials,
          revision: currentRevision + 1,
        },
      });

      await tx.adminAuditEvent.create({
        data: {
          actorType: 'ADMIN',
          actorId: params.adminId,
          targetType: 'CONNECTOR',
          targetId: params.connectorId,
          action: 'CONNECTOR_POLICY_CHANGED',
          reason,
          before: {
            allowNewCredentials: currentAllow,
            revision: currentRevision,
          },
          after: {
            allowNewCredentials: params.allowNewCredentials,
            revision: updated.revision,
          },
        },
      });

      return {
        connectorId: updated.connectorId,
        allowNewCredentials: updated.allowNewCredentials,
        revision: updated.revision,
        updatedAt: updated.updatedAt,
      };
    });
  }
}

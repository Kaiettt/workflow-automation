import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { NodeTypePolicyPort } from '../../application/ports/node-type-policy.port';
import {
  ChangeNodeTypeStatusParams,
  NodeTypePolicyError,
  NodeTypePolicySnapshot,
  planNodeTypeStatusChange,
} from '../../domain/node-type-policy';

@Injectable()
export class PrismaNodeTypePolicyRepository extends NodeTypePolicyPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }
  async isExecutionAllowed(key: string): Promise<boolean> {
    const policy = await this.prisma.nodeTypePolicy.findUnique({
      where: { nodeTypeKey: key },
      select: { isExecutionAllowed: true },
    });
    return policy?.isExecutionAllowed ?? true;
  }
  changeStatus(
    params: ChangeNodeTypeStatusParams,
  ): Promise<NodeTypePolicySnapshot> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(7261103)::text`;
      const definition = await tx.nodeTypeDefinition.findUnique({
        where: { key: params.nodeTypeKey },
        include: { policy: true },
      });
      if (!definition)
        throw new NodeTypePolicyError(
          'NODE_TYPE_NOT_FOUND',
          'Node type not found',
        );
      const current: NodeTypePolicySnapshot = definition.policy ?? {
        nodeTypeKey: definition.key,
        isCatalogVisible: true,
        isExecutionAllowed: true,
        revision: 0,
        updatedAt: definition.updatedAt,
      };
      const next = planNodeTypeStatusChange(current, params);
      if (!next.changed) return current;
      const data = {
        isCatalogVisible: next.isCatalogVisible,
        isExecutionAllowed: next.isExecutionAllowed,
        revision: next.revision,
      };
      const updated = await tx.nodeTypePolicy.upsert({
        where: { nodeTypeKey: definition.key },
        create: { nodeTypeKey: definition.key, ...data },
        update: data,
      });
      await tx.adminAuditEvent.create({
        data: {
          actorType: 'ADMIN',
          actorId: params.adminId,
          targetType: 'NODE_TYPE',
          targetId: definition.id,
          action: 'NODE_TYPE_STATUS_CHANGED',
          reason: next.reason,
          before: {
            key: definition.key,
            isCatalogVisible: current.isCatalogVisible,
            isExecutionAllowed: current.isExecutionAllowed,
            revision: current.revision,
          },
          after: { key: definition.key, ...data },
        },
      });
      return updated;
    });
  }
}

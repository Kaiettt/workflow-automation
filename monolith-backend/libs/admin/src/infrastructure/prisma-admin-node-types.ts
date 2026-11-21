import { Prisma } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import {
  NodeTypeAdminDetail,
  NodeTypeAdminPage,
  NodeTypeAdminSummary,
  NodeTypeFilter,
} from '../application/node-type-admin.types';

const joins = Prisma.sql`FROM node_type_definitions n LEFT JOIN node_type_policies p ON p.node_type_key = n.key LEFT JOIN connectors c ON c.id = n.connector_id`;
const columns = Prisma.sql`n.id, n.key, n.display_name AS "displayName", n.icon, n.color, n.category,
 n.connector_id AS "connectorId", c.key AS "connectorKey", c.name AS "connectorName",
 COALESCE(p.is_catalog_visible, true) AS "isCatalogVisible", COALESCE(p.is_execution_allowed, true) AS "isExecutionAllowed",
 COALESCE(p.revision, 0) AS revision, n.created_at AS "createdAt", COALESCE(p.updated_at, n.updated_at) AS "updatedAt",
 (SELECT COUNT(*)::int FROM workflows w JOIN workflow_versions v ON v.id = w.current_version_id
  WHERE w.status = 'PUBLISHED' AND v.definition @> jsonb_build_object('nodes', jsonb_build_array(jsonb_build_object('data', jsonb_build_object('key', n.key))))) AS "publishedWorkflowCount",
 (SELECT COUNT(*)::int FROM workflows w JOIN workflow_drafts d ON d.workflow_id = w.id
  WHERE w.status = 'DRAFT' AND d.definition @> jsonb_build_object('nodes', jsonb_build_array(jsonb_build_object('data', jsonb_build_object('key', n.key))))) AS "draftWorkflowCount"`;

export async function readAdminNodeTypes(
  prisma: PrismaService,
  filter: NodeTypeFilter,
): Promise<NodeTypeAdminPage> {
  const conditions: Prisma.Sql[] = [Prisma.sql`true`];
  if (filter.q) {
    const q = '%' + filter.q.replace(/[\\%_]/g, '\\$&') + '%';
    conditions.push(
      Prisma.sql`(n.key ILIKE ${q} OR n.display_name ILIKE ${q})`,
    );
  }
  if (filter.category)
    conditions.push(Prisma.sql`n.category::text = ${filter.category}`);
  if (filter.connectorId)
    conditions.push(Prisma.sql`n.connector_id = ${filter.connectorId}::uuid`);
  if (filter.isCatalogVisible !== undefined)
    conditions.push(
      Prisma.sql`COALESCE(p.is_catalog_visible, true) = ${filter.isCatalogVisible}`,
    );
  if (filter.isExecutionAllowed !== undefined)
    conditions.push(
      Prisma.sql`COALESCE(p.is_execution_allowed, true) = ${filter.isExecutionAllowed}`,
    );
  const where = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
  const order =
    filter.sortBy === 'updatedAt'
      ? Prisma.sql`COALESCE(p.updated_at, n.updated_at)`
      : Prisma.sql`n.display_name`;
  const direction =
    filter.sortOrder === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const [items, counts] = await prisma.$transaction(
    [
      prisma.$queryRaw<
        NodeTypeAdminSummary[]
      >`SELECT ${columns} ${joins} ${where} ORDER BY ${order} ${direction}, n.key ASC LIMIT ${filter.pageSize} OFFSET ${(filter.page - 1) * filter.pageSize}`,
      prisma.$queryRaw<
        { total: number }[]
      >`SELECT COUNT(*)::int AS total ${joins} ${where}`,
    ],
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  return {
    items,
    total: counts[0]?.total ?? 0,
    page: filter.page,
    pageSize: filter.pageSize,
  };
}

export async function readAdminNodeType(
  prisma: PrismaService,
  key: string,
): Promise<NodeTypeAdminDetail> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<
        (NodeTypeAdminSummary & {
          configSchema: unknown;
          inputSchema: unknown;
          outputSchema: unknown;
        })[]
      >`
      SELECT ${columns}, n.config_schema AS "configSchema", n.input_schema AS "inputSchema", n.output_schema AS "outputSchema" ${joins} WHERE n.key = ${key}`;
      const node = rows[0];
      if (!node) throw new NotFoundException('Node type not found');
      const contains = JSON.stringify({ nodes: [{ data: { key } }] });
      const workflows = await tx.$queryRaw<NodeTypeAdminDetail['workflows']>`
      SELECT w.id, w.name, u.email AS "ownerEmail", w.status FROM workflows w JOIN users u ON u.id = w.owner_id
      LEFT JOIN workflow_versions v ON v.id = w.current_version_id LEFT JOIN workflow_drafts d ON d.workflow_id = w.id
      WHERE (w.status = 'PUBLISHED' AND v.definition @> ${contains}::jsonb)
         OR (w.status = 'DRAFT' AND d.definition @> ${contains}::jsonb)
      ORDER BY w.updated_at DESC, w.id ASC LIMIT 10`;
      return { ...node, workflows };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

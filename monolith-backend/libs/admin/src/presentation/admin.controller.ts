import {
  BadRequestException,
  NotFoundException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
  UseFilters,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ChangeNodeTypeStatusCommand,
  NodeTypePolicyExceptionFilter,
} from '@app/node-library';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@app/auth/infrastructure/guards/roles.guard';
import { Roles } from '@app/auth/infrastructure/decorators/roles.decorator';
import { ADMIN_ROLE } from '@app/auth/application/account-permissions';
import {
  CurrentUser,
  AuthenticatedUser,
} from '@app/auth/infrastructure/decorators/current-user.decorator';
import { ManageAccountCommand } from '@app/auth/application/commands/manage-account.command';
import { ChangeConnectorPolicyCommand } from '@app/connector/application/commands/change-connector-policy.command';
import {
  AdminBodyFields,
  AdminMutationFieldsGuard,
} from './admin-mutation-fields.guard';
import { AdminReadQuery } from '../application/admin-read.query';
import type {
  AdminAuditPage,
  AdminAuditDetail,
} from '../application/admin-audit.types';
import { adminListRange } from './admin-read-validation';
import type {
  AdminExecutionPage,
  AdminExecutionDetail,
} from '../application/admin-execution.types';
import {
  ActiveDto,
  AdminAuditFilterDto,
  AdminExecutionFilterDto,
  NodeTypesDto,
  NodeTypeKeyDto,
  ChangeNodeTypeStatusDto,
  ChangeConnectorPolicyDto,
  ConnectorsDto,
  DashboardDto,
  PageDto,
  RoleDto,
  UsersDto,
} from './admin.dto';

@Controller('api/admin')
@UseFilters(NodeTypePolicyExceptionFilter)
@UseGuards(JwtAuthGuard, RolesGuard, AdminMutationFieldsGuard)
@Roles(ADMIN_ROLE)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class AdminController {
  constructor(
    private readonly queries: QueryBus,
    private readonly commands: CommandBus,
  ) {}
  @Get('audit-events')
  async auditEvents(@Query() query: AdminAuditFilterDto) {
    const range = adminListRange(query);
    return {
      success: true,
      data: await this.queries.execute<AdminReadQuery, AdminAuditPage>(
        new AdminReadQuery({
          kind: 'auditEvents',
          filter: { ...query, ...range },
        }),
      ),
    };
  }
  @Get('audit-events/:id')
  async auditEvent(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.queries.execute<
      AdminReadQuery,
      AdminAuditDetail | null
    >(new AdminReadQuery({ kind: 'auditEvent', id }));
    if (!data) throw new NotFoundException('Audit event not found');
    return { success: true, data };
  }
  @Get('executions')
  async executions(@Query() query: AdminExecutionFilterDto) {
    const { from, to } = adminListRange(query);
    return {
      success: true,
      data: await this.queries.execute<AdminReadQuery, AdminExecutionPage>(
        new AdminReadQuery({
          kind: 'executions',
          filter: { ...query, from, to },
        }),
      ),
    };
  }
  @Get('executions/:id')
  async execution(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.queries.execute<
      AdminReadQuery,
      AdminExecutionDetail | null
    >(new AdminReadQuery({ kind: 'execution', id }));
    if (!data) throw new NotFoundException('Execution not found');
    return { success: true, data };
  }
  @Get('node-types')
  async nodeTypes(@Query() query: NodeTypesDto) {
    return {
      success: true,
      data: await this.queries.execute<AdminReadQuery, unknown>(
        new AdminReadQuery({
          kind: 'nodeTypes',
          filter: {
            ...query,
            isCatalogVisible:
              query.isCatalogVisible === undefined
                ? undefined
                : query.isCatalogVisible === 'true',
            isExecutionAllowed:
              query.isExecutionAllowed === undefined
                ? undefined
                : query.isExecutionAllowed === 'true',
          },
        }),
      ),
    };
  }
  @Get('node-types/:key')
  async nodeType(@Param() params: NodeTypeKeyDto) {
    return {
      success: true,
      data: await this.queries.execute<AdminReadQuery, unknown>(
        new AdminReadQuery({ kind: 'nodeType', key: params.key }),
      ),
    };
  }
  @AdminBodyFields('isCatalogVisible', 'isExecutionAllowed')
  @Patch('node-types/:key/status')
  async nodeTypeStatus(
    @Param() params: NodeTypeKeyDto,
    @Body() change: ChangeNodeTypeStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (
      change.isCatalogVisible === undefined &&
      change.isExecutionAllowed === undefined
    )
      throw new BadRequestException('Provide at least one policy flag');
    return {
      success: true,
      data: await this.commands.execute<ChangeNodeTypeStatusCommand, unknown>(
        new ChangeNodeTypeStatusCommand({
          ...change,
          nodeTypeKey: params.key,
          adminId: user.id,
        }),
      ),
    };
  }
  @Get('users') async users(@Query() query: UsersDto) {
    return {
      success: true,
      data: await this.queries.execute<AdminReadQuery, unknown>(
        new AdminReadQuery({
          kind: 'users',
          filter: {
            ...query,
            isActive:
              query.isActive === undefined
                ? undefined
                : query.isActive === 'true',
          },
        }),
      ),
    };
  }
  @Get('users/:id') async user(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      data: await this.queries.execute<AdminReadQuery, unknown>(
        new AdminReadQuery({ kind: 'user', id }),
      ),
    };
  }
  @Get('users/:id/workflows') async workflows(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filter: PageDto,
  ) {
    return {
      success: true,
      data: await this.queries.execute<AdminReadQuery, unknown>(
        new AdminReadQuery({ kind: 'workflows', id, filter }),
      ),
    };
  }
  @AdminBodyFields('isActive')
  @Patch('users/:id/active')
  async active(
    @Param('id', ParseUUIDPipe) targetId: string,
    @Body() change: ActiveDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      success: true,
      data: await this.commands.execute<ManageAccountCommand, unknown>(
        new ManageAccountCommand({ ...change, targetId, actorId: user.id }),
      ),
    };
  }
  @AdminBodyFields('role')
  @Patch('users/:id/role')
  async role(
    @Param('id', ParseUUIDPipe) targetId: string,
    @Body() change: RoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      success: true,
      data: await this.commands.execute<ManageAccountCommand, unknown>(
        new ManageAccountCommand({ ...change, targetId, actorId: user.id }),
      ),
    };
  }
  @Get('dashboard') async dashboard(@Query() query: DashboardDto) {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 7 * 86400000);
    if (from >= to || to.getTime() - from.getTime() > 90 * 86400000)
      throw new BadRequestException('Select a valid range of up to 90 days');
    try {
      new Intl.DateTimeFormat('en', { timeZone: query.timezone });
    } catch {
      throw new BadRequestException('Invalid timezone');
    }
    return {
      success: true,
      data: await this.queries.execute<AdminReadQuery, unknown>(
        new AdminReadQuery({
          kind: 'dashboard',
          filter: { from, to, timezone: query.timezone },
        }),
      ),
    };
  }

  @Get('connectors')
  async connectors(@Query() query: ConnectorsDto) {
    return {
      success: true,
      data: await this.queries.execute<AdminReadQuery, unknown>(
        new AdminReadQuery({
          kind: 'connectors',
          filter: {
            ...query,
            isActive:
              query.isActive === undefined
                ? undefined
                : query.isActive === 'true',
            allowNewCredentials:
              query.allowNewCredentials === undefined
                ? undefined
                : query.allowNewCredentials === 'true',
          },
        }),
      ),
    };
  }

  @Get('connectors/:id')
  async connector(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      data: await this.queries.execute<AdminReadQuery, unknown>(
        new AdminReadQuery({ kind: 'connector', id }),
      ),
    };
  }

  @AdminBodyFields('allowNewCredentials')
  @Patch('connectors/:id/credential-policy')
  async credentialPolicy(
    @Param('id', ParseUUIDPipe) targetId: string,
    @Body() change: ChangeConnectorPolicyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      success: true,
      data: await this.commands.execute<ChangeConnectorPolicyCommand, unknown>(
        new ChangeConnectorPolicyCommand({
          connectorId: targetId,
          allowNewCredentials: change.allowNewCredentials,
          reason: change.reason,
          expectedRevision: change.expectedRevision,
          adminId: user.id,
        }),
      ),
    };
  }
}

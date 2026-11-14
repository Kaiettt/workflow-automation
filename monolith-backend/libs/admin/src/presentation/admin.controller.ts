import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@app/auth/infrastructure/guards/roles.guard';
import { Roles } from '@app/auth/infrastructure/decorators/roles.decorator';
import { ADMIN_ROLE } from '@app/auth/application/account-permissions';
import {
  CurrentUser,
  AuthenticatedUser,
} from '@app/auth/infrastructure/decorators/current-user.decorator';
import { ManageAccountCommand } from '@app/auth/application/commands/manage-account.command';
import {
  AdminBodyFields,
  AdminMutationFieldsGuard,
} from './admin-mutation-fields.guard';
import { AdminReadQuery } from '../application/admin-read.query';
import {
  ActiveDto,
  DashboardDto,
  PageDto,
  RoleDto,
  UsersDto,
} from './admin.dto';

@Controller('api/admin')
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
}

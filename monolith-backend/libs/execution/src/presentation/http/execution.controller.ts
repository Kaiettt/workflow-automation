import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import {
  CurrentUser,
  AuthenticatedUser,
} from '@app/auth/infrastructure/decorators/current-user.decorator';
import { StartExecutionCommand } from '../../application/commands/start-execution/start-execution.command';
import { StartExecutionDto } from './dtos/start-execution.dto';
import { GetExecutionQuery } from '../../application/queries/get-execution/get-execution.query';
import { ListExecutionsQuery } from '../../application/queries/list-executions/list-executions.query';
import { ListExecutionsDto } from './dtos/list-executions.dto';
import { ExecutionStreamService } from '../../application/services/execution-stream.service';

@ApiTags('executions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/executions')
export class ExecutionController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly streamService: ExecutionStreamService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Run a published workflow version manually' })
  async start(
    @Body() body: StartExecutionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const result: unknown = await this.commandBus.execute(
      new StartExecutionCommand(
        body.workflow_version_id,
        user.id,
        idempotencyKey,
      ),
    );
    return { success: true, data: result };
  }

  @Sse(':executionId/events')
  @ApiOperation({ summary: 'Subscribe to execution lifecycle events via SSE' })
  stream(
    @Param('executionId') executionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Observable<MessageEvent> {
    return this.streamService.createStream(executionId, user.id);
  }

  @Get(':executionId')
  @ApiOperation({ summary: 'Get execution status and results' })
  async get(
    @Param('executionId') executionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result: unknown = await this.queryBus.execute(
      new GetExecutionQuery(executionId, user.id),
    );
    return { success: true, data: result };
  }

  @Get()
  @ApiOperation({ summary: 'List recent executions for a workflow' })
  async list(
    @Query() query: ListExecutionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result: unknown = await this.queryBus.execute(
      new ListExecutionsQuery(
        query.workflow_id,
        user.id,
        query.workflow_version_id,
        query.cursor,
        query.limit ?? 20,
      ),
    );
    return { success: true, data: result };
  }
}

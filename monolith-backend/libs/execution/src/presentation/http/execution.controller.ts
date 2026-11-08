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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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
import { ExecutionEventPublisher } from '../../application/ports/execution-event-publisher.port';
import { isTerminalExecutionState } from '../../domain/constants/execution.constants';

@ApiTags('executions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/executions')
export class ExecutionController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly eventPublisher: ExecutionEventPublisher,
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

  @Get(':executionId/events')
  @ApiOperation({ summary: 'Subscribe to execution lifecycle events' })
  async stream(
    @Param('executionId') executionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    await this.queryBus.execute(new GetExecutionQuery(executionId, user.id));

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (event: { event: string; data: unknown }) => {
      if (closed || res.writableEnded) return;
      res.write(`event: ${event.event}\n`);
      res.write(`data: ${JSON.stringify(event.data)}\n\n`);
    };

    let closed = false;
    let unsubscribe: () => void = () => undefined;
    const heartbeat = setInterval(() => {
      if (!closed && !res.writableEnded) {
        res.write(': heartbeat\n\n');
      }
    }, 15000);
    const cleanup = () => {
      if (closed) return;
      closed = true;
      unsubscribe();
      clearInterval(heartbeat);
      if (!res.writableEnded) {
        res.end();
      }
    };

    res.on('close', cleanup);
    unsubscribe = this.eventPublisher.subscribe(executionId, (event) => {
      send({ event: event.event, data: event });

      if (isTerminalExecutionState(event.event, event.status)) {
        cleanup();
      }
    });

    const snapshot: unknown = await this.queryBus.execute(
      new GetExecutionQuery(executionId, user.id),
    );
    send({
      event: 'execution.snapshot',
      data: {
        event: 'execution.snapshot',
        executionId,
        payload: snapshot,
        ts: new Date().toISOString(),
      },
    });
    if (
      snapshot &&
      typeof snapshot === 'object' &&
      'status' in snapshot &&
      isTerminalExecutionState('execution.snapshot', snapshot.status)
    ) {
      cleanup();
    }
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

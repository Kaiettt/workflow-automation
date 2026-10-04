import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '@app/auth/infrastructure/decorators/current-user.decorator';
import { StartExecutionCommand } from '../../application/commands/start-execution/start-execution.command';
import { StartExecutionDto } from './dtos/start-execution.dto';

@ApiTags('executions')
@ApiBearerAuth()
@Controller('api/executions')
export class ExecutionController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @ApiOperation({ summary: 'Run a published workflow version manually' })
  async start(
    @Body() body: StartExecutionDto,
    @Req() req: Request & { user?: AuthenticatedUser },
  ) {
    let actorId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    const authHeader = req.headers?.authorization;
    if ((!req.user || !req.user.id) && authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const decoded = JSON.parse(
            Buffer.from(payloadBase64, 'base64').toString('utf-8'),
          ) as { sub?: string; id?: string };
          actorId = decoded.id || decoded.sub || actorId;
        }
      } catch {
        // Fallback to default actorId
      }
    }

    const result: unknown = await this.commandBus.execute(
      new StartExecutionCommand(body.workflow_version_id, actorId),
    );
    return { success: true, data: result };
  }
}


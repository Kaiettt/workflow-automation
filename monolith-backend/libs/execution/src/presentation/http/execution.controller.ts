import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import {
  CurrentUser,
  AuthenticatedUser,
} from '@app/auth/infrastructure/decorators/current-user.decorator';
import { StartExecutionCommand } from '../../application/commands/start-execution/start-execution.command';
import { StartExecutionDto } from './dtos/start-execution.dto';

@ApiTags('executions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/executions')
export class ExecutionController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @ApiOperation({ summary: 'Run a published workflow version manually' })
  async start(
    @Body() body: StartExecutionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result: unknown = await this.commandBus.execute(
      new StartExecutionCommand(body.workflow_version_id, user.id),
    );
    return { success: true, data: result };
  }
}



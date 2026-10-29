import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import {
  CurrentUser,
  AuthenticatedUser,
} from '@app/auth/infrastructure/decorators/current-user.decorator';
import {
  GetWorkflowTriggersQuery,
  WorkflowTriggerView,
} from '../../application/queries/get-workflow-triggers.query';

@ApiTags('workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/workflows')
export class WorkflowTriggersController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id/triggers')
  @ApiOperation({
    summary: 'Listeners (e.g. webhook URLs) of the published version',
  })
  async list(
    @Param('id', ParseUUIDPipe) workflowId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const triggers = await this.queryBus.execute<
      GetWorkflowTriggersQuery,
      WorkflowTriggerView[]
    >(new GetWorkflowTriggersQuery(workflowId, user.id));
    return { success: true, data: triggers };
  }
}

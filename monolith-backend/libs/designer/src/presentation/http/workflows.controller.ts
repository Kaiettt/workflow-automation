import { Body, Controller, Post, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateWorkflowCommand } from '../../application/commands/create-workflow.handler';
import { CreateWorkflowDto } from './dtos/create-workflow.dto';

@ApiTags('workflows')
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workflow' })
  @ApiResponse({ status: 201, description: 'Workflow created successfully' })
  async createWorkflow(@Body() body: CreateWorkflowDto, @Req() req: any) {
    // Hardcoded ownerId for MVP, would normally come from req.user
    const ownerId = body.ownerId || req.user?.id || '00000000-0000-0000-0000-000000000000';
    const command = new CreateWorkflowCommand(body.name, ownerId);
    const workflowId = await this.commandBus.execute(command);
    
    return {
      success: true,
      data: {
        id: workflowId,
      },
    };
  }
}

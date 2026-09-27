/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Controller, Post, Body, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateWorkflowCommand } from '../../application/commands/create-workflow.handler';
import { PublishWorkflowCommand } from '../../application/commands/publish-workflow.handler';
import { CreateWorkflowDto } from './dtos/create-workflow.dto';

@ApiTags('workflows')
@Controller('api/workflows')
export class WorkflowsController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/versions')
  @ApiOperation({ summary: 'Publish a workflow draft to a new version' })
  @ApiResponse({ status: 201, description: 'Workflow published successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async publishWorkflow(
    @Param('id') id: string,
    @Req() req: Request & { user?: { id: string } },
  ) {
    const ownerId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    const command = new PublishWorkflowCommand(id, ownerId);

    // Command handler returns { versionId, versionNumber }
    const result = await this.commandBus.execute(command);

    return {
      success: true,
      data: result,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new workflow' })
  @ApiResponse({ status: 201, description: 'Workflow created successfully' })
  async createWorkflow(
    @Body() body: CreateWorkflowDto,
    @Req() req: Request & { user?: { id: string } },
  ) {
    // Hardcoded ownerId for MVP, would normally come from req.user
    const ownerId =
      body.ownerId || req.user?.id || '00000000-0000-0000-0000-000000000000';
    const command = new CreateWorkflowCommand(body.name, ownerId);
    const result: unknown = await this.commandBus.execute(command);
    const workflowId = result as string;

    return {
      success: true,
      data: {
        id: workflowId,
      },
    };
  }
}

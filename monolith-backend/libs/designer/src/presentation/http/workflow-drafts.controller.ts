import { Body, Controller, Param, Put, Get } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SaveDraftCommand } from '../../application/commands/save-draft.handler';
import { GetWorkflowDraftQuery } from '../../application/queries/get-workflow-draft.handler';
import { SaveDraftDto } from './dtos/save-draft.dto';

@ApiTags('workflows')
@Controller('workflows')
export class WorkflowDraftsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get(':id/draft')
  @ApiOperation({ summary: 'Get workflow draft', description: 'Retrieves a workflow draft.' })
  @ApiParam({ name: 'id', description: 'The workflow ID' })
  @ApiResponse({ status: 200, description: 'Workflow draft retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Workflow draft not found' })
  async getDraft(@Param('id') id: string) {
    const query = new GetWorkflowDraftQuery(id);
    const draft = await this.queryBus.execute(query);
    
    return {
      success: true,
      data: draft,
    };
  }

  @Put(':id/draft')
  @ApiOperation({ summary: 'Save workflow draft', description: 'Upserts a workflow draft. The parent workflow must exist.' })
  @ApiParam({ name: 'id', description: 'The workflow ID' })
  @ApiResponse({ status: 200, description: 'Workflow draft saved successfully' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async saveDraft(@Param('id') id: string, @Body() body: SaveDraftDto) {
    const command = new SaveDraftCommand(id, body.definition);
    const workflowId = await this.commandBus.execute(command);
    
    return {
      success: true,
      data: {
        workflowId,
        updatedAt: new Date().toISOString(),
      },
    };
  }
}

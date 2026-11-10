import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import {
  CurrentUser,
  AuthenticatedUser,
} from '@app/auth/infrastructure/decorators/current-user.decorator';
import { CreateWorkflowCommand } from '../../application/commands/create-workflow.command';
import { RenameWorkflowCommand } from '../../application/commands/rename-workflow.command';
import { DeleteWorkflowCommand } from '../../application/commands/delete-workflow.command';
import { PublishWorkflowCommand } from '../../application/commands/publish-workflow.command';
import { RestoreVersionCommand } from '../../application/commands/restore-version.command';
import {
  GetDraftStatusQuery,
  DraftStatusResult,
} from '../../application/queries/get-draft-status.query';
import { GetWorkflowsQuery } from '../../application/queries/get-workflows.query';
import { GetWorkflowVersionsQuery } from '../../application/queries/get-workflow-versions.query';
import { GetWorkflowVersionQuery } from '../../application/queries/get-workflow-version.query';
import {
  WorkflowSummaryDto,
  WorkflowVersionSummaryDto,
  WorkflowVersionDetailDto,
} from '../../application/dtos/workflow-queries.dto';
import {
  CreateWorkflowDto,
  RenameWorkflowDto,
} from './dtos/create-workflow.dto';
import { RestoreVersionDto } from './dtos/restore-version.dto';

@ApiTags('workflows')
@Controller('api/workflows')
export class WorkflowsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of workflows owned by caller' })
  @ApiResponse({ status: 200, description: 'List of workflows returned' })
  async getWorkflows(@CurrentUser() user: AuthenticatedUser) {
    const workflows: WorkflowSummaryDto[] = await this.queryBus.execute(
      new GetWorkflowsQuery(user.id),
    );
    return {
      success: true,
      data: workflows,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rename a workflow owned by caller' })
  async renameWorkflow(
    @Param('id') id: string,
    @Body() body: RenameWorkflowDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const name = body.name.trim();
    if (!name || name.length > 255) {
      throw new BadRequestException(
        'Workflow name must be between 1 and 255 characters.',
      );
    }
    await this.commandBus.execute(new RenameWorkflowCommand(id, user.id, name));
    return { success: true, data: { id, name } };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a workflow and its execution history' })
  async deleteWorkflow(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.commandBus.execute(new DeleteWorkflowCommand(id, user.id));
    return { success: true, data: { id } };
  }

  @Post(':id/versions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish a workflow draft to a new version' })
  @ApiResponse({ status: 201, description: 'Workflow published successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async publishWorkflow(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const command = new PublishWorkflowCommand(id, user.id);

    // Command handler returns { versionId, versionNumber }
    const result: unknown = await this.commandBus.execute(command);

    return {
      success: true,
      data: result,
    };
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get list of published versions of a workflow' })
  @ApiParam({ name: 'id', description: 'The workflow ID' })
  @ApiResponse({ status: 200, description: 'List of versions returned' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async getVersions(@Param('id') id: string) {
    const versions: WorkflowVersionSummaryDto[] = await this.queryBus.execute(
      new GetWorkflowVersionsQuery(id),
    );
    return {
      success: true,
      data: versions,
    };
  }

  @Get(':id/versions/:versionId')
  @ApiOperation({ summary: 'Get a specific version of a workflow' })
  @ApiParam({ name: 'id', description: 'The workflow ID' })
  @ApiParam({ name: 'versionId', description: 'The version ID' })
  @ApiResponse({ status: 200, description: 'Version details returned' })
  @ApiResponse({ status: 404, description: 'Version not found' })
  async getVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    const version: WorkflowVersionDetailDto = await this.queryBus.execute(
      new GetWorkflowVersionQuery(id, versionId),
    );
    return {
      success: true,
      data: version,
    };
  }

  @Post(':id/versions/:versionId/restore')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore a published version into workflow draft' })
  @ApiParam({ name: 'id', description: 'The workflow ID' })
  @ApiParam({ name: 'versionId', description: 'The version ID to restore' })
  @ApiResponse({ status: 200, description: 'Version restored into draft' })
  @ApiResponse({ status: 400, description: 'Invalid strategy or version' })
  @ApiResponse({ status: 404, description: 'Workflow or version not found' })
  async restoreVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Body() body: RestoreVersionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const command = new RestoreVersionCommand(
      id,
      versionId,
      user.id,
      body.strategy,
      body.backupWorkflowName,
      body.publishComment,
    );
    const result: unknown = await this.commandBus.execute(command);

    return {
      success: true,
      data: result,
      message: 'Phiên bản đã được khôi phục vào bản nháp thành công.',
    };
  }

  @Get(':id/draft/status')
  @ApiOperation({ summary: 'Get draft status and check unpublished changes' })
  @ApiParam({ name: 'id', description: 'The workflow ID' })
  @ApiResponse({ status: 200, description: 'Draft status returned' })
  async getDraftStatus(@Param('id') id: string) {
    const query = new GetDraftStatusQuery(id);
    const result: DraftStatusResult = await this.queryBus.execute(query);
    return {
      success: true,
      data: result,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new workflow' })
  @ApiResponse({ status: 201, description: 'Workflow created successfully' })
  async createWorkflow(
    @Body() body: CreateWorkflowDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const ownerId = body.ownerId || user.id;
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

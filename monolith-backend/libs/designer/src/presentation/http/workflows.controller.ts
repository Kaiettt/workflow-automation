/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  NotFoundException,
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
import { PublishWorkflowCommand } from '../../application/commands/publish-workflow.command';
import { RestoreVersionCommand } from '../../application/commands/restore-version.command';
import { GetDraftStatusQuery } from '../../application/queries/get-draft-status.query';
import { CreateWorkflowDto } from './dtos/create-workflow.dto';
import { RestoreVersionDto } from './dtos/restore-version.dto';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository';
import { WorkflowVersionRepository } from '../../domain/repositories/workflow-version.repository';

@ApiTags('workflows')
@Controller('api/workflows')
export class WorkflowsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly workflowRepo: WorkflowRepository,
    private readonly workflowVersionRepo: WorkflowVersionRepository,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of workflows owned by caller' })
  @ApiResponse({ status: 200, description: 'List of workflows returned' })
  async getWorkflows(@CurrentUser() user: AuthenticatedUser) {
    const workflows = await this.workflowRepo.findByOwnerId(user.id);
    return {
      success: true,
      data: workflows.map((w) => ({
        id: w.id,
        name: w.name,
        status: w.status,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
    };
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
    const result = await this.commandBus.execute(command);

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
    const workflow = await this.workflowRepo.findById(id);
    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found.`);
    }
    const versions = await this.workflowVersionRepo.findByWorkflowId(id);
    return {
      success: true,
      data: versions.map((v) => ({
        id: v.id,
        workflowId: v.workflowId,
        versionNumber: v.versionNumber,
        publishedAt: v.publishedAt,
        publishedById: v.publishedById,
      })),
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
    const workflow = await this.workflowRepo.findById(id);
    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found.`);
    }
    const version = await this.workflowVersionRepo.findById(versionId);
    if (!version || version.workflowId !== id) {
      throw new NotFoundException(`Version with ID ${versionId} not found.`);
    }
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
    const result = await this.queryBus.execute(query);
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

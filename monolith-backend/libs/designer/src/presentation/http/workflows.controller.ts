/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CreateWorkflowCommand } from '../../application/commands/create-workflow.handler';
import { PublishWorkflowCommand } from '../../application/commands/publish-workflow.handler';
import { RestoreVersionCommand } from '../../application/commands/restore-version.handler';
import { GetDraftStatusQuery } from '../../application/queries/get-draft-status.handler';
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
  @ApiOperation({ summary: 'Get list of workflows owned by caller' })
  @ApiResponse({ status: 200, description: 'List of workflows returned' })
  async getWorkflows(@Req() req: Request & { user?: { id: string } }) {
    const ownerId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    const workflows = await this.workflowRepo.findByOwnerId(ownerId);
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
    @Req() req: Request & { user?: { id: string } },
  ) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    const command = new RestoreVersionCommand(
      id,
      versionId,
      userId,
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

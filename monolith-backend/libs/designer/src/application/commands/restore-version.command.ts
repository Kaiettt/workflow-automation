import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/database/prisma/prisma.service';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository';
import { WorkflowDraftRepository } from '../../domain/repositories/workflow-draft.repository';
import { WorkflowVersionRepository } from '../../domain/repositories/workflow-version.repository';
import { RestoreStrategy } from '../../presentation/http/dtos/restore-version.dto';
import { Prisma } from '@prisma/client';

export class RestoreVersionCommand {
  constructor(
    public readonly workflowId: string,
    public readonly versionId: string,
    public readonly userId: string,
    public readonly strategy: RestoreStrategy,
    public readonly backupWorkflowName?: string,
    public readonly publishComment?: string,
  ) {}
}

export interface RestoreVersionResult {
  workflowId: string;
  restoredFromVersionId: string;
  restoredVersionNumber: number;
  strategyUsed: RestoreStrategy;
  newPublishedVersionNumber?: number;
  backupWorkflowId?: string;
  draftUpdatedAt: string;
  definition: any;
}

@CommandHandler(RestoreVersionCommand)
export class RestoreVersionHandler implements ICommandHandler<RestoreVersionCommand> {
  constructor(
    private readonly workflowRepo: WorkflowRepository,
    private readonly workflowDraftRepo: WorkflowDraftRepository,
    private readonly workflowVersionRepo: WorkflowVersionRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: RestoreVersionCommand): Promise<RestoreVersionResult> {
    const { workflowId, versionId, userId, strategy, backupWorkflowName } =
      command;

    const workflow = await this.workflowRepo.findById(workflowId);
    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${workflowId} not found.`);
    }

    const targetVersion = await this.workflowVersionRepo.findById(versionId);
    if (!targetVersion) {
      throw new NotFoundException(
        `Workflow version with ID ${versionId} not found.`,
      );
    }

    if (targetVersion.workflowId !== workflowId) {
      throw new BadRequestException(
        'Target version does not belong to this workflow.',
      );
    }

    const currentDraft = await this.workflowDraftRepo.findById(workflowId);

    let newPublishedVersionNumber: number | undefined;
    let backupWorkflowId: string | undefined;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Handle strategy PUBLISH_THEN_RESTORE
      if (strategy === RestoreStrategy.PUBLISH_THEN_RESTORE) {
        if (currentDraft && currentDraft.definition) {
          const maxVersion = await tx.workflowVersion.aggregate({
            where: { workflowId },
            _max: { versionNumber: true },
          });
          const nextVersionNumber = (maxVersion._max.versionNumber ?? 0) + 1;

          const newVer = await tx.workflowVersion.create({
            data: {
              workflowId,
              versionNumber: nextVersionNumber,
              definition: currentDraft.definition as Prisma.InputJsonValue,
              publishedById: userId,
            },
          });
          newPublishedVersionNumber = newVer.versionNumber;

          // Update workflow's currentVersionId to the newly published version
          await tx.workflow.update({
            where: { id: workflowId },
            data: { currentVersionId: newVer.id },
          });
        }
      }

      // 2. Handle strategy BACKUP_THEN_RESTORE
      if (strategy === RestoreStrategy.BACKUP_THEN_RESTORE) {
        if (currentDraft && currentDraft.definition) {
          const backup = await tx.workflow.create({
            data: {
              name:
                backupWorkflowName ||
                `[Backup] ${workflow.name} - ${new Date().toISOString()}`,
              ownerId: workflow.ownerId,
              status: 'DRAFT',
              draft: {
                create: {
                  definition: currentDraft.definition as Prisma.InputJsonValue,
                },
              },
            },
          });
          backupWorkflowId = backup.id;
        }
      }

      // 3. Update or create workflow_draft with targetVersion.definition
      const updatedDraft = await tx.workflowDraft.upsert({
        where: { workflowId },
        update: {
          definition: targetVersion.definition as Prisma.InputJsonValue,
          validationErrors: Prisma.JsonNull,
          updatedAt: new Date(),
        },
        create: {
          workflowId,
          definition: targetVersion.definition as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });

      return updatedDraft;
    });

    return {
      workflowId,
      restoredFromVersionId: targetVersion.id,
      restoredVersionNumber: targetVersion.versionNumber,
      strategyUsed: strategy,
      newPublishedVersionNumber,
      backupWorkflowId,
      draftUpdatedAt: result.updatedAt.toISOString(),
      definition: targetVersion.definition,
    };
  }
}

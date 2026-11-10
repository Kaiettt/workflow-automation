import { Injectable, Optional } from '@nestjs/common';
import { ExecutionRepository } from '../../domain/repositories/execution.repository';
import { NodeLogRecord } from '../../domain/models/execution.types';
import { ExecutionStatus } from '../../domain/constants/execution.constants';
import {
  ExecutionEventPublisher,
  publishExecutionEventSafely,
} from '../ports/execution-event-publisher.port';
import { Item } from '../../domain/models/item';
import { NodeRunParams, NodeRunResult } from './node-runner';

// Raised when a per_item node fails part-way; carries the progress summary for the log.
export class ItemRunError extends Error {
  constructor(
    message: string,
    readonly summary: {
      total_items: number;
      processed: number;
      failed_at_index: number;
    },
  ) {
    super(message);
  }
}

export function sanitizeErrorText(message: string): string {
  return (
    message
      .replace(/\b(?:sk-ant-|sk-)[A-Za-z0-9_-]{16,}/g, '[REDACTED]')
      .replace(/\bAIza[0-9A-Za-z_-]{20,}/g, '[REDACTED]')
      // Meta Page / user access tokens.
      .replace(/\bEAA[A-Za-z0-9]{20,}/g, '[REDACTED]')
      .replace(
        /(access_token|refresh_token|token|encrypted_secret|ENCRYPTION_KEY|client_secret|Bearer [A-Za-z0-9._~+/=-]+)/gi,
        '[REDACTED]',
      )
      .replace(/\b[a-fA-F0-9]{32,}\b/g, '[REDACTED]')
  );
}

@Injectable()
export class NodeExecutionObserver {
  constructor(
    private readonly repository: ExecutionRepository,
    @Optional() private readonly eventPublisher?: ExecutionEventPublisher,
  ) {}

  async notifyStarted(params: NodeRunParams, startedAt: Date): Promise<void> {
    const { node, items } = params;
    await this.repository.saveNodeLog(params.executionId, {
      nodeId: node.id,
      nodeKey: node.data?.key ?? 'unknown',
      status: ExecutionStatus.RUNNING,
      input: items,
      output: null,
      startedAt,
      finishedAt: null,
    });
    await publishExecutionEventSafely(this.eventPublisher, {
      event: 'node.started',
      executionId: params.executionId,
      workflowId: params.workflowId,
      nodeId: node.id,
      nodeKey: node.data?.key ?? 'unknown',
      status: ExecutionStatus.RUNNING,
      startedAt: startedAt.toISOString(),
      finishedAt: null,
      ts: startedAt.toISOString(),
    });
  }

  async notifyCompleted(
    params: NodeRunParams,
    outputs: Map<string, Item[]>,
    startedAt: Date,
    finishedAt: Date = new Date(),
  ): Promise<NodeRunResult> {
    const { node, items } = params;
    const output = [...outputs.values()].flat();
    const log: NodeLogRecord = {
      nodeId: node.id,
      nodeKey: node.data?.key ?? 'unknown',
      status: ExecutionStatus.SUCCESS,
      input: items,
      output,
      startedAt,
      finishedAt,
    };

    await this.repository.saveNodeLog(params.executionId, log);
    await publishExecutionEventSafely(this.eventPublisher, {
      event: 'node.completed',
      executionId: params.executionId,
      workflowId: params.workflowId,
      workflowVersionId: params.workflowVersionId,
      nodeId: node.id,
      nodeKey: node.data?.key ?? 'unknown',
      status: ExecutionStatus.SUCCESS,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      ts: finishedAt.toISOString(),
    });

    return {
      log,
      output,
      outputs,
      status: ExecutionStatus.SUCCESS,
    };
  }

  async notifyFailed(
    params: NodeRunParams,
    error: unknown,
    startedAt: Date,
    finishedAt: Date = new Date(),
  ): Promise<NodeRunResult> {
    const { node, items } = params;
    const message =
      error instanceof Error ? error.message : 'Node execution failed';
    const log: NodeLogRecord = {
      nodeId: node.id,
      nodeKey: node.data?.key ?? 'unknown',
      status: ExecutionStatus.FAILED,
      input: items,
      output: error instanceof ItemRunError ? error.summary : null,
      errorMessage: sanitizeErrorText(message),
      startedAt,
      finishedAt,
    };

    await this.repository.saveNodeLog(params.executionId, log);
    await publishExecutionEventSafely(this.eventPublisher, {
      event: 'node.failed',
      executionId: params.executionId,
      workflowId: params.workflowId,
      workflowVersionId: params.workflowVersionId,
      nodeId: node.id,
      nodeKey: node.data?.key ?? 'unknown',
      status: ExecutionStatus.FAILED,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      ts: finishedAt.toISOString(),
    });

    return {
      log,
      output: [],
      outputs: new Map(),
      status: ExecutionStatus.FAILED,
    };
  }

  async notifySkipped(params: {
    executionId: string;
    workflowId: string;
    workflowVersionId: string;
    nodeId: string;
    nodeKey: string;
    timestamp?: Date;
  }): Promise<void> {
    const now = params.timestamp ?? new Date();
    await this.repository.saveNodeLog(params.executionId, {
      nodeId: params.nodeId,
      nodeKey: params.nodeKey,
      status: 'SKIPPED',
      input: [],
      output: null,
      startedAt: now,
      finishedAt: now,
    });
    await publishExecutionEventSafely(this.eventPublisher, {
      event: 'node.skipped',
      executionId: params.executionId,
      workflowId: params.workflowId,
      workflowVersionId: params.workflowVersionId,
      nodeId: params.nodeId,
      nodeKey: params.nodeKey,
      status: 'SKIPPED',
      startedAt: now.toISOString(),
      finishedAt: now.toISOString(),
      ts: now.toISOString(),
    });
  }
}

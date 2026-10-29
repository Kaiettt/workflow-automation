import type { Node } from '@xyflow/react';
import type { WorkflowValidationIssue } from '../models/workflow-validation.model';

export interface GroupedNodeErrors {
  nodeId?: string;
  nodeName: string;
  issues: WorkflowValidationIssue[];
}

export const KNOWN_FIELD_LABELS: Record<string, string> = {
  spreadsheet_id: 'Spreadsheet ID',
  sheet_name: 'Sheet Name',
  credential_id: 'Credential',
  to: 'Recipient (To)',
  subject: 'Subject',
  body: 'Body',
  field: 'Field',
  operator: 'Operator',
  value: 'Value',
  model: 'Model',
  prompt: 'Prompt',
  provider: 'Provider',
  system_prompt: 'System Prompt',
  max_tokens: 'Max Tokens',
  temperature: 'Temperature',
  channel: 'Channel',
  max_items: 'Max Items',
  output_format: 'Output Format',
  url: 'URL',
  webhook_url: 'Webhook URL',
  method: 'HTTP Method',
  headers: 'Headers',
  code: 'Code',
  conditions: 'Conditions',
  cron_expression: 'Cron Expression',
  interval: 'Interval',
  timezone: 'Timezone',
};

export function formatFieldLabel(field?: string): string {
  if (!field) return '';
  if (KNOWN_FIELD_LABELS[field]) return KNOWN_FIELD_LABELS[field];
  return field
    .replace(/([A-Z])/g, ' $1')
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

export function formatHumanFriendlyIssue(issue: WorkflowValidationIssue): string {
  if (issue.code === 'REQUIRED_FIELD_MISSING' && issue.field) {
    return `${formatFieldLabel(issue.field)} is required`;
  }
  if (issue.code === 'ACTION_UNREACHABLE') {
    return 'This node is not connected to any trigger';
  }
  if (issue.code === 'UNKNOWN_NODE_TYPE') {
    return 'This node type is not supported or missing in catalog';
  }
  if (issue.code === 'NO_TRIGGER') {
    return 'Workflow must contain at least one trigger node';
  }
  if (issue.code === 'NO_ACTION') {
    return 'Workflow must contain at least one action or processing node';
  }
  return issue.message;
}

export function groupValidationIssues(
  issues: WorkflowValidationIssue[],
  nodes: Node[],
  fallbackMessage?: string,
): GroupedNodeErrors[] {
  const nodeMap = new Map<string, Node>(nodes.map((n) => [n.id, n]));
  const groupedByNode = new Map<string, WorkflowValidationIssue[]>();
  const workflowLevelIssues: WorkflowValidationIssue[] = [];

  for (const issue of issues) {
    if (issue.nodeId) {
      const list = groupedByNode.get(issue.nodeId) ?? [];
      list.push(issue);
      groupedByNode.set(issue.nodeId, list);
    } else {
      workflowLevelIssues.push(issue);
    }
  }

  const groups: GroupedNodeErrors[] = [];

  if (workflowLevelIssues.length > 0) {
    groups.push({
      nodeName: 'Workflow Configuration',
      issues: workflowLevelIssues,
    });
  } else if (issues.length === 0 && fallbackMessage) {
    groups.push({
      nodeName: 'Workflow Configuration',
      issues: [
        {
          code: 'GENERAL_ERROR',
          severity: 'error',
          message: fallbackMessage,
        },
      ],
    });
  }

  for (const [nodeId, nodeIssues] of groupedByNode.entries()) {
    const node = nodeMap.get(nodeId);
    const nodeName = String(node?.data?.name ?? 'Action Node');
    groups.push({
      nodeId,
      nodeName,
      issues: nodeIssues,
    });
  }

  return groups;
}

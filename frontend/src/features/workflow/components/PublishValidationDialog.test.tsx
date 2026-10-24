import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Node } from '@xyflow/react';
import { PublishValidationDialog } from './PublishValidationDialog';
import {
  formatFieldLabel,
  formatHumanFriendlyIssue,
  groupValidationIssues,
} from '../utils/workflow-validation.util';
import type { WorkflowValidationIssue } from '../models/workflow-validation.model';

describe('PublishValidationDialog Error Coverage', () => {
  const sampleNodes: Node[] = [
    {
      id: 'node-sheet-1',
      type: 'actionNode',
      position: { x: 100, y: 100 },
      data: { name: 'Read Google Sheet', key: 'integration.google_sheet.readRows' },
    },
    {
      id: 'node-gmail-1',
      type: 'actionNode',
      position: { x: 300, y: 100 },
      data: { name: 'Send Gmail', key: 'integration.gmail.send' },
    },
    {
      id: 'node-unreachable-1',
      type: 'actionNode',
      position: { x: 500, y: 100 },
      data: { name: 'Slack Notification', key: 'integration.slack.post_message' },
    },
  ];

  it('formats field names into human-readable labels', () => {
    expect(formatFieldLabel('spreadsheet_id')).toBe('Spreadsheet ID');
    expect(formatFieldLabel('sheet_name')).toBe('Sheet Name');
    expect(formatFieldLabel('credential_id')).toBe('Credential');
    expect(formatFieldLabel('to')).toBe('Recipient (To)');
    expect(formatFieldLabel('subject')).toBe('Subject');
    expect(formatFieldLabel('body')).toBe('Body');
    expect(formatFieldLabel('custom_api_key')).toBe('Custom Api Key');
  });

  it('formats all backend validation issue codes to friendly text', () => {
    expect(
      formatHumanFriendlyIssue({
        code: 'REQUIRED_FIELD_MISSING',
        severity: 'error',
        field: 'spreadsheet_id',
        message: 'Raw message',
      }),
    ).toBe('Spreadsheet ID is required');

    expect(
      formatHumanFriendlyIssue({
        code: 'ACTION_UNREACHABLE',
        severity: 'error',
        message: 'Raw message',
      }),
    ).toBe('This node is not connected to any trigger');

    expect(
      formatHumanFriendlyIssue({
        code: 'UNKNOWN_NODE_TYPE',
        severity: 'error',
        message: 'Raw message',
      }),
    ).toBe('This node type is not supported or missing in catalog');

    expect(
      formatHumanFriendlyIssue({
        code: 'NO_TRIGGER',
        severity: 'error',
        message: 'Workflow must contain at least one trigger node.',
      }),
    ).toBe('Workflow must contain at least one trigger node');

    expect(
      formatHumanFriendlyIssue({
        code: 'NO_ACTION',
        severity: 'error',
        message: 'Workflow must contain at least one action node.',
      }),
    ).toBe('Workflow must contain at least one action or processing node');
  });

  it('groups multiple errors by node and hides technical IDs', () => {
    const issues: WorkflowValidationIssue[] = [
      {
        code: 'REQUIRED_FIELD_MISSING',
        severity: 'error',
        message: 'spreadsheet_id is missing',
        nodeId: 'node-sheet-1',
        field: 'spreadsheet_id',
      },
      {
        code: 'REQUIRED_FIELD_MISSING',
        severity: 'error',
        message: 'sheet_name is missing',
        nodeId: 'node-sheet-1',
        field: 'sheet_name',
      },
      {
        code: 'REQUIRED_FIELD_MISSING',
        severity: 'error',
        message: 'subject is missing',
        nodeId: 'node-gmail-1',
        field: 'subject',
      },
      {
        code: 'REQUIRED_FIELD_MISSING',
        severity: 'error',
        message: 'body is missing',
        nodeId: 'node-gmail-1',
        field: 'body',
      },
    ];

    const groups = groupValidationIssues(issues, sampleNodes);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.nodeName).toBe('Read Google Sheet');
    expect(groups[0]?.issues).toHaveLength(2);
    expect(groups[1]?.nodeName).toBe('Send Gmail');
    expect(groups[1]?.issues).toHaveLength(2);
  });

  it('renders all backend error types in the dialog and allows selecting nodes', () => {
    const onSelectNode = vi.fn();
    const onOpenChange = vi.fn();

    const issues: WorkflowValidationIssue[] = [
      {
        code: 'REQUIRED_FIELD_MISSING',
        severity: 'error',
        message: 'Spreadsheet ID missing',
        nodeId: 'node-sheet-1',
        field: 'spreadsheet_id',
      },
      {
        code: 'ACTION_UNREACHABLE',
        severity: 'error',
        message: 'Slack Notification is unreachable',
        nodeId: 'node-unreachable-1',
      },
      {
        code: 'NO_TRIGGER',
        severity: 'error',
        message: 'Workflow must contain at least one trigger node.',
      },
    ];

    render(
      <PublishValidationDialog
        open={true}
        onOpenChange={onOpenChange}
        issues={issues}
        nodes={sampleNodes}
        onSelectNode={onSelectNode}
      />,
    );

    // Dialog header
    expect(screen.getByText('Workflow Issues Found')).toBeTruthy();
    expect(screen.getByText('3 errors')).toBeTruthy();

    // Node groups rendered with friendly titles
    expect(screen.getByText('Read Google Sheet')).toBeTruthy();
    expect(screen.getByText('Spreadsheet ID is required')).toBeTruthy();

    expect(screen.getByText('Slack Notification')).toBeTruthy();
    expect(screen.getByText('This node is not connected to any trigger')).toBeTruthy();

    // Workflow-level group
    expect(screen.getByText('Workflow Configuration')).toBeTruthy();
    expect(screen.getByText('Workflow must contain at least one trigger node')).toBeTruthy();

    // Technical IDs should not be visible in displayed text
    expect(screen.queryByText('node-sheet-1')).toBeNull();
    expect(screen.queryByText('node-unreachable-1')).toBeNull();

    // Fix button triggers node selection
    fireEvent.click(screen.getByRole('button', { name: 'Focus node node-sheet-1' }));
    expect(onSelectNode).toHaveBeenCalledWith('node-sheet-1');
  });
});

import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import type { WorkflowValidationIssue } from '../models/workflow-validation.model';
import {
  formatFieldLabel,
  formatHumanFriendlyIssue,
  groupValidationIssues,
} from './workflow-validation.util';

describe('workflow-validation.util', () => {
  describe('formatFieldLabel', () => {
    it('returns empty string when field is undefined', () => {
      expect(formatFieldLabel(undefined)).toBe('');
    });

    it('returns predefined known field labels', () => {
      expect(formatFieldLabel('spreadsheet_id')).toBe('Spreadsheet ID');
      expect(formatFieldLabel('webhook_url')).toBe('Webhook URL');
      expect(formatFieldLabel('cron_expression')).toBe('Cron Expression');
      expect(formatFieldLabel('credential_id')).toBe('Credential');
    });

    it('formats unknown snake_case and camelCase field names gracefully', () => {
      expect(formatFieldLabel('custom_user_id')).toBe('Custom User Id');
      expect(formatFieldLabel('retryCount')).toBe('Retry Count');
    });
  });

  describe('formatHumanFriendlyIssue', () => {
    it('formats REQUIRED_FIELD_MISSING with human friendly field name', () => {
      const issue: WorkflowValidationIssue = {
        code: 'REQUIRED_FIELD_MISSING',
        severity: 'error',
        message: 'Raw error',
        field: 'webhook_url',
      };
      expect(formatHumanFriendlyIssue(issue)).toBe('Webhook URL is required');
    });

    it('formats standard workflow error codes', () => {
      expect(
        formatHumanFriendlyIssue({
          code: 'ACTION_UNREACHABLE',
          severity: 'error',
          message: '',
        }),
      ).toBe('This node is not connected to any trigger');

      expect(
        formatHumanFriendlyIssue({
          code: 'UNKNOWN_NODE_TYPE',
          severity: 'error',
          message: '',
        }),
      ).toBe('This node type is not supported or missing in catalog');

      expect(
        formatHumanFriendlyIssue({
          code: 'NO_TRIGGER',
          severity: 'error',
          message: '',
        }),
      ).toBe('Workflow must contain at least one trigger node');

      expect(
        formatHumanFriendlyIssue({
          code: 'NO_ACTION',
          severity: 'error',
          message: '',
        }),
      ).toBe('Workflow must contain at least one action or processing node');
    });

    it('falls back to issue message for unknown error codes', () => {
      expect(
        formatHumanFriendlyIssue({
          code: 'CUSTOM_ERROR',
          severity: 'warning',
          message: 'Something went wrong',
        }),
      ).toBe('Something went wrong');
    });
  });

  describe('groupValidationIssues', () => {
    const mockNodes: Node[] = [
      {
        id: 'node-1',
        position: { x: 0, y: 0 },
        data: { name: 'Send Email' },
      },
      {
        id: 'node-2',
        position: { x: 100, y: 100 },
        data: { name: 'HTTP Webhook' },
      },
    ];

    it('groups issues by nodeId and workflow-level', () => {
      const issues: WorkflowValidationIssue[] = [
        {
          code: 'NO_TRIGGER',
          severity: 'error',
          message: 'Workflow has no trigger',
        },
        {
          code: 'REQUIRED_FIELD_MISSING',
          severity: 'error',
          message: 'To is required',
          nodeId: 'node-1',
          field: 'to',
        },
        {
          code: 'REQUIRED_FIELD_MISSING',
          severity: 'error',
          message: 'Body is required',
          nodeId: 'node-1',
          field: 'body',
        },
      ];

      const groups = groupValidationIssues(issues, mockNodes);

      expect(groups).toHaveLength(2);
      expect(groups[0]).toEqual({
        nodeName: 'Workflow Configuration',
        issues: [issues[0]],
      });
      expect(groups[1]).toEqual({
        nodeId: 'node-1',
        nodeName: 'Send Email',
        issues: [issues[1], issues[2]],
      });
    });

    it('handles fallbackMessage when issues array is empty', () => {
      const groups = groupValidationIssues([], mockNodes, 'General failure');

      expect(groups).toHaveLength(1);
      expect(groups[0].nodeName).toBe('Workflow Configuration');
      expect(groups[0].issues[0].message).toBe('General failure');
    });
  });
});


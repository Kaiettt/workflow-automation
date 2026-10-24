/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import {
  getNodeKey,
  extractNodeCatalogKeys,
  getTriggerNodes,
  getActionNodes,
  validateWorkflowDraft,
} from '@app/designer/application/utils/workflow-validation.util';

describe('Workflow Validation Utils', () => {
  describe('getNodeKey', () => {
    it('should extract catalog key from node.data.key', () => {
      const node = {
        id: 'node-1',
        type: 'actionNode',
        data: { key: 'ai.llm.generate', config: {} },
      };
      expect(getNodeKey(node)).toBe('ai.llm.generate');
    });

    it('should fallback to node.type if node.data.key is not provided and type is not a ReactFlow UI node', () => {
      const node = {
        id: 'node-2',
        type: 'trigger.manual',
        data: {},
      };
      expect(getNodeKey(node)).toBe('trigger.manual');
    });

    it('should return undefined if node.type is ReactFlow UI node and node.data.key is missing', () => {
      const node = {
        id: 'node-3',
        type: 'actionNode',
        data: {},
      };
      expect(getNodeKey(node)).toBeUndefined();
    });
  });

  describe('extractNodeCatalogKeys', () => {
    it('should extract unique keys from a list of nodes', () => {
      const nodes = [
        { id: '1', data: { key: 'trigger.manual' } },
        { id: '2', data: { key: 'ai.llm.generate' } },
        { id: '3', data: { key: 'ai.llm.generate' } },
      ];
      expect(extractNodeCatalogKeys(nodes)).toEqual([
        'trigger.manual',
        'ai.llm.generate',
      ]);
    });
  });

  describe('getTriggerNodes & getActionNodes', () => {
    const catalogMap = new Map<string, { category: string }>([
      ['trigger.manual', { category: 'TRIGGER' }],
      ['logic.filter', { category: 'LOGIC' }],
      ['data.aggregate', { category: 'DATA_PROCESSING' }],
      ['ai.llm.generate', { category: 'AI' }],
    ]);

    const nodes = [
      { id: 't1', data: { key: 'trigger.manual' } },
      { id: 'a1', data: { key: 'logic.filter' } },
      { id: 'a2', data: { key: 'data.aggregate' } },
      { id: 'a3', data: { key: 'ai.llm.generate' } },
    ];

    it('should correctly filter trigger nodes', () => {
      const triggers = getTriggerNodes(nodes, catalogMap);
      expect(triggers.map((n) => n.id)).toEqual(['t1']);
    });

    it('should correctly filter all non-trigger operational nodes as action nodes', () => {
      const actions = getActionNodes(nodes, catalogMap);
      expect(actions.map((n) => n.id)).toEqual(['a1', 'a2', 'a3']);
    });
  });

  describe('validateWorkflowDraft', () => {
    const catalogMap = new Map<string, { category: string; configSchema: any }>(
      [
        [
          'trigger.manual',
          { category: 'TRIGGER', configSchema: { properties: {} } },
        ],
        [
          'integration.google_sheet.readRows',
          {
            category: 'INTEGRATION',
            configSchema: {
              required: ['credential_id', 'spreadsheet_id', 'sheet_name'],
            },
          },
        ],
      ],
    );

    it('should flag REQUIRED_FIELD_MISSING if required config field is whitespace or missing', () => {
      const definition = {
        nodes: [
          {
            id: 't1',
            type: 'triggerNode',
            data: { key: 'trigger.manual', config: {} },
          },
          {
            id: 'a1',
            type: 'actionNode',
            data: {
              key: 'integration.google_sheet.readRows',
              config: { credential_id: 'c1', spreadsheet_id: '   ' }, // missing sheet_name, empty spreadsheet_id
            },
          },
        ],
        edges: [{ source: 't1', target: 'a1' }],
      };

      const report = validateWorkflowDraft(definition, catalogMap);
      expect(report.isValid).toBe(false);
      expect(report.issues).toContainEqual(
        expect.objectContaining({
          code: 'REQUIRED_FIELD_MISSING',
          nodeId: 'a1',
          field: 'spreadsheet_id',
        }),
      );
      expect(report.issues).toContainEqual(
        expect.objectContaining({
          code: 'REQUIRED_FIELD_MISSING',
          nodeId: 'a1',
          field: 'sheet_name',
        }),
      );
    });
  });
});

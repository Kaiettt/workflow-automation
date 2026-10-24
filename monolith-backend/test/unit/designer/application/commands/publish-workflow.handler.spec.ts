/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */
import { BadRequestException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  PublishWorkflowCommand,
  PublishWorkflowHandler,
} from '@app/designer/application/commands/publish-workflow.command';
import { Workflow } from '@app/designer/domain/entities/workflow.entity';
import { WorkflowDraft } from '@app/designer/domain/entities/workflow-draft.entity';
import { WorkflowVersion } from '@app/designer/domain/entities/workflow-version.entity';
import { WorkflowRepository } from '@app/designer/domain/repositories/workflow.repository';
import { WorkflowDraftRepository } from '@app/designer/domain/repositories/workflow-draft.repository';
import { WorkflowVersionRepository } from '@app/designer/domain/repositories/workflow-version.repository';

// Mock catalog schema data matching sample.data.json
const catalogSchemas: Record<string, { category: string; configSchema: any }> =
  {
    'trigger.manual': {
      category: 'TRIGGER',
      configSchema: { type: 'object', properties: {} },
    },
    'integration.google_sheet.readRows': {
      category: 'INTEGRATION',
      configSchema: {
        type: 'object',
        required: ['credential_id', 'spreadsheet_id', 'sheet_name'],
        properties: {
          credential_id: { type: 'string' },
          spreadsheet_id: { type: 'string' },
          sheet_name: { type: 'string' },
        },
      },
    },
    'logic.filter': {
      category: 'LOGIC',
      configSchema: {
        type: 'object',
        required: ['field', 'operator', 'value'],
        properties: {
          field: { type: 'string' },
          operator: { type: 'string' },
          value: { type: 'string' },
        },
      },
    },
    'data.aggregate': {
      category: 'DATA_PROCESSING',
      configSchema: {
        type: 'object',
        properties: { field: { type: 'string', default: 'items' } },
      },
    },
    'ai.llm.generate': {
      category: 'AI',
      configSchema: {
        type: 'object',
        required: ['provider', 'credential_id', 'model', 'prompt'],
        properties: {
          provider: { type: 'string' },
          credential_id: { type: 'string' },
          model: { type: 'string' },
          prompt: { type: 'string' },
        },
      },
    },
    'integration.gmail.send': {
      category: 'INTEGRATION',
      configSchema: {
        type: 'object',
        required: ['credential_id', 'to', 'subject', 'body'],
        properties: {
          credential_id: { type: 'string' },
          to: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
        },
      },
    },
  };

class InMemoryWorkflowRepo extends WorkflowRepository {
  workflows = new Map<string, Workflow>();
  create = jest.fn();
  findById = jest.fn(async (id: string) => this.workflows.get(id) ?? null);
  findByOwnerId = jest.fn();
  update = jest.fn(async (workflow: Workflow) => {
    this.workflows.set(workflow.id, workflow);
    return workflow;
  });
  delete = jest.fn();
  findByNameAndOwnerId = jest.fn();
}

class InMemoryWorkflowDraftRepo extends WorkflowDraftRepository {
  drafts = new Map<string, WorkflowDraft>();
  findById = jest.fn(async (id: string) => this.drafts.get(id) ?? null);
  upsert = jest.fn(async (draft: WorkflowDraft) => {
    this.drafts.set(draft.workflowId, draft);
    return draft;
  });
  delete = jest.fn();
}

class InMemoryWorkflowVersionRepo extends WorkflowVersionRepository {
  versions: WorkflowVersion[] = [];
  save = jest.fn(async (version: WorkflowVersion) => {
    this.versions.push(version);
  });
  findById = jest.fn();
  findByWorkflowId = jest.fn();
  findLatestByWorkflowId = jest.fn(async (workflowId: string) => {
    const list = this.versions.filter((v) => v.workflowId === workflowId);
    return list.length > 0 ? list[list.length - 1] : null;
  });
  findByWorkflowIdAndVersionNumber = jest.fn();
}

describe('PublishWorkflowHandler (TDD)', () => {
  let handler: PublishWorkflowHandler;
  let workflowRepo: InMemoryWorkflowRepo;
  let draftRepo: InMemoryWorkflowDraftRepo;
  let versionRepo: InMemoryWorkflowVersionRepo;
  let queryBus: jest.Mocked<QueryBus>;

  const validDefinition = {
    nodes: [
      {
        id: 'triggerNode-1792224328950',
        type: 'triggerNode',
        data: {
          key: 'trigger.manual',
          name: 'Manual Trigger',
          config: {},
        },
      },
      {
        id: 'actionNode-1792224333910',
        type: 'actionNode',
        data: {
          key: 'integration.google_sheet.readRows',
          name: 'Read Google Sheet Rows',
          config: {
            sheet_name: 'Sheet1',
            credential_id: 'a2c90569-9eae-4a43-b150-3959a53527d9',
            spreadsheet_id: '19nZNvZobCKH4th-vKy00Po-3SknXD8v-VEDDm_qwmPk',
          },
        },
      },
      {
        id: 'actionNode-1792224342073',
        type: 'actionNode',
        data: {
          key: 'logic.filter',
          name: 'Filter',
          config: {
            field: 'status',
            value: 'new',
            operator: 'equals',
          },
        },
      },
      {
        id: 'actionNode-1792224340416',
        type: 'actionNode',
        data: {
          key: 'data.aggregate',
          name: 'Aggregate',
          config: {
            field: 'items',
          },
        },
      },
      {
        id: 'actionNode-1792220527195',
        type: 'actionNode',
        data: {
          key: 'ai.llm.generate',
          name: 'LLM',
          config: {
            provider: 'gemini',
            credential_id: '9318a77f-2cb0-431f-966c-f06d7e36dcaa',
            model: 'gemini-1.5-flash',
            prompt: 'Summarize',
          },
        },
      },
      {
        id: 'actionNode-1792224337378',
        type: 'actionNode',
        data: {
          key: 'integration.gmail.send',
          name: 'Send Gmail',
          config: {
            to: 'test@example.com',
            body: 'Summary',
            subject: 'Report',
            credential_id: '6d84f3ae-b7db-429d-9067-062e713a0e41',
          },
        },
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'triggerNode-1792224328950',
        target: 'actionNode-1792224333910',
      },
      {
        id: 'edge-2',
        source: 'actionNode-1792224333910',
        target: 'actionNode-1792224342073',
      },
      {
        id: 'edge-3',
        source: 'actionNode-1792224342073',
        target: 'actionNode-1792224340416',
      },
      {
        id: 'edge-4',
        source: 'actionNode-1792224340416',
        target: 'actionNode-1792220527195',
      },
      {
        id: 'edge-5',
        source: 'actionNode-1792220527195',
        target: 'actionNode-1792224337378',
      },
    ],
  };

  beforeEach(() => {
    workflowRepo = new InMemoryWorkflowRepo();
    draftRepo = new InMemoryWorkflowDraftRepo();
    versionRepo = new InMemoryWorkflowVersionRepo();

    queryBus = {
      execute: jest.fn(async (query: any) => {
        const keys: string[] = query.keys || [];
        return keys
          .filter((k) => catalogSchemas[k])
          .map((k) => ({
            key: k,
            category: catalogSchemas[k].category,
            configSchema: catalogSchemas[k].configSchema,
          }));
      }),
    } as any;

    handler = new PublishWorkflowHandler(
      workflowRepo,
      draftRepo,
      versionRepo,
      queryBus,
    );
  });

  it('should successfully publish a valid workflow draft', async () => {
    const workflowId = 'wf-test-valid';
    const userId = 'user-1';

    const workflow = Workflow.create({
      id: workflowId,
      name: 'Saved Workflow',
      ownerId: userId,
    });
    workflowRepo.workflows.set(workflowId, workflow);

    const draft = WorkflowDraft.create(workflowId, validDefinition);
    draftRepo.drafts.set(workflowId, draft);

    const result = await handler.execute(
      new PublishWorkflowCommand(workflowId, userId),
    );

    expect(result).toBeDefined();
    expect(result.versionNumber).toBe(1);
    expect(versionRepo.versions.length).toBe(1);
    expect(workflowRepo.workflows.get(workflowId)?.currentVersionId).toBe(
      result.versionId,
    );
  });

  it('should reject publish with NO_TRIGGER when draft definition has no trigger node', async () => {
    const workflowId = 'wf-no-trigger';
    const userId = 'user-1';

    const workflow = Workflow.create({
      id: workflowId,
      name: 'No Trigger',
      ownerId: userId,
    });
    workflowRepo.workflows.set(workflowId, workflow);

    // Remove trigger node from valid definition
    const defWithoutTrigger = {
      nodes: validDefinition.nodes.filter(
        (n: any) =>
          n.data?.key !== 'trigger.manual' && n.type !== 'triggerNode',
      ),
      edges: validDefinition.edges,
    };

    const draft = WorkflowDraft.create(workflowId, defWithoutTrigger);
    draftRepo.drafts.set(workflowId, draft);

    await expect(
      handler.execute(new PublishWorkflowCommand(workflowId, userId)),
    ).rejects.toThrow(BadRequestException);

    expect(draft.validationErrors?.issues).toContainEqual(
      expect.objectContaining({ code: 'NO_TRIGGER' }),
    );
  });

  it('should reject publish with NO_ACTION when draft definition has no action or processing nodes', async () => {
    const workflowId = 'wf-no-action';
    const userId = 'user-1';

    const workflow = Workflow.create({
      id: workflowId,
      name: 'No Action',
      ownerId: userId,
    });
    workflowRepo.workflows.set(workflowId, workflow);

    const defOnlyTrigger = {
      nodes: validDefinition.nodes.filter(
        (n: any) => n.data?.key === 'trigger.manual',
      ),
      edges: [],
    };

    const draft = WorkflowDraft.create(workflowId, defOnlyTrigger);
    draftRepo.drafts.set(workflowId, draft);

    await expect(
      handler.execute(new PublishWorkflowCommand(workflowId, userId)),
    ).rejects.toThrow(BadRequestException);

    expect(draft.validationErrors?.issues).toContainEqual(
      expect.objectContaining({ code: 'NO_ACTION' }),
    );
  });

  it('should reject publish with REQUIRED_FIELD_MISSING when a node is missing a required config field', async () => {
    const workflowId = 'wf-missing-config';
    const userId = 'user-1';

    const workflow = Workflow.create({
      id: workflowId,
      name: 'Missing Config',
      ownerId: userId,
    });
    workflowRepo.workflows.set(workflowId, workflow);

    // Clone definition and clear required field 'sheet_name' on Google Sheet node
    const defMissingField = JSON.parse(JSON.stringify(validDefinition));
    const sheetNode = defMissingField.nodes.find(
      (n: any) => n.data?.key === 'integration.google_sheet.readRows',
    );
    delete sheetNode.data.config.sheet_name;

    const draft = WorkflowDraft.create(workflowId, defMissingField);
    draftRepo.drafts.set(workflowId, draft);

    await expect(
      handler.execute(new PublishWorkflowCommand(workflowId, userId)),
    ).rejects.toThrow(BadRequestException);

    expect(draft.validationErrors?.issues).toContainEqual(
      expect.objectContaining({
        code: 'REQUIRED_FIELD_MISSING',
        nodeId: sheetNode.id,
        field: 'sheet_name',
      }),
    );
  });

  it('should reject publish with ACTION_UNREACHABLE when an action node is disconnected from triggers', async () => {
    const workflowId = 'wf-disconnected';
    const userId = 'user-1';

    const workflow = Workflow.create({
      id: workflowId,
      name: 'Disconnected',
      ownerId: userId,
    });
    workflowRepo.workflows.set(workflowId, workflow);

    // Clone definition and remove all edges connecting to the last node (Gmail send)
    const defDisconnected = JSON.parse(JSON.stringify(validDefinition));
    defDisconnected.edges = defDisconnected.edges.filter(
      (e: any) => e.target !== 'actionNode-1792224337378',
    );

    const draft = WorkflowDraft.create(workflowId, defDisconnected);
    draftRepo.drafts.set(workflowId, draft);

    await expect(
      handler.execute(new PublishWorkflowCommand(workflowId, userId)),
    ).rejects.toThrow(BadRequestException);

    expect(draft.validationErrors?.issues).toContainEqual(
      expect.objectContaining({
        code: 'ACTION_UNREACHABLE',
        nodeId: 'actionNode-1792224337378',
      }),
    );
  });

  it('should reject publish with UNKNOWN_NODE_TYPE when a node has a key not found in catalog', async () => {
    const workflowId = 'wf-unknown-node';
    const userId = 'user-1';

    const workflow = Workflow.create({
      id: workflowId,
      name: 'Unknown Node',
      ownerId: userId,
    });
    workflowRepo.workflows.set(workflowId, workflow);

    const defUnknown = JSON.parse(JSON.stringify(validDefinition));
    defUnknown.nodes.push({
      id: 'actionNode-unknown',
      type: 'actionNode',
      data: { key: 'nonexistent.custom.node', config: {} },
    });
    defUnknown.edges.push({
      id: 'edge-to-unknown',
      source: 'actionNode-1792224337378',
      target: 'actionNode-unknown',
    });

    const draft = WorkflowDraft.create(workflowId, defUnknown);
    draftRepo.drafts.set(workflowId, draft);

    await expect(
      handler.execute(new PublishWorkflowCommand(workflowId, userId)),
    ).rejects.toThrow(BadRequestException);

    expect(draft.validationErrors?.issues).toContainEqual(
      expect.objectContaining({
        code: 'UNKNOWN_NODE_TYPE',
        nodeId: 'actionNode-unknown',
      }),
    );
  });
});

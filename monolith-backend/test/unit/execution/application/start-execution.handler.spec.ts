import {
  ExecutionStatus,
  NodeKeys,
} from '@app/execution/domain/constants/execution.constants';
import {
  build,
  chain,
  decode,
  FakeCatalog,
  filterNode,
  gmailNode,
  jsonOf,
  logOf,
  Row,
  sheetNode,
  trigger,
} from '@test/support/execution/start-execution.test-support';
import { NodeCatalogPort } from '@app/execution/application/ports/node-catalog.port';

describe('StartExecutionHandler', () => {
  it('filters sheet rows to those whose status equals new', async () => {
    const { run } = build(chain([trigger, sheetNode, filterNode()]));
    const result = await run();

    const triggerLog = logOf(result.nodeLogs, NodeKeys.TRIGGER_MANUAL);
    expect(triggerLog?.input).toEqual([]);
    expect(triggerLog?.output).toEqual([{ json: {} }]);

    const filterLog = logOf(result.nodeLogs, NodeKeys.LOGIC_FILTER);
    expect(jsonOf(filterLog?.input)).toEqual([
      { name: 'Kiet', email: 'kiet@gmail.com', status: 'new' },
      { name: 'An', email: 'an@gmail.com', status: 'contacted' },
      { name: 'Minh', email: 'minh@gmail.com', status: 'new' },
    ]);
    expect(filterLog?.output).toEqual([
      {
        json: { name: 'Kiet', email: 'kiet@gmail.com', status: 'new' },
        pairedItem: 0,
      },
      {
        json: { name: 'Minh', email: 'minh@gmail.com', status: 'new' },
        pairedItem: 2,
      },
    ]);
    expect(result.status).toBe(ExecutionStatus.SUCCESS);
  });

  it('marks the node as failed when the configured credential id is the placeholder value', async () => {
    const placeholderSheet = {
      ...sheetNode,
      data: {
        ...sheetNode.data,
        config: {
          ...sheetNode.data.config,
          credential_id: 'google-credential',
        },
      },
    };
    const { run } = build(chain([trigger, placeholderSheet]));
    const result = await run();
    const sheetLog = logOf(result.nodeLogs, NodeKeys.GOOGLE_SHEET_READ_ROWS);

    expect(sheetLog?.status).toBe(ExecutionStatus.FAILED);
    expect(result.status).toBe(ExecutionStatus.FAILED);
  });

  it('interpolates Gmail templates written for the previous engine (no "to", bare {{name}})', async () => {
    const { run, send } = build(
      chain([
        trigger,
        sheetNode,
        filterNode(),
        gmailNode({ subject: 'Welcome, {{name}}!', body: 'Hello {{email}}' }),
      ]),
    );
    const result = await run();

    expect(send).toHaveBeenCalledTimes(2);
    expect(decode(send, 0)).toContain('To: kiet@gmail.com');
    expect(decode(send, 0)).toContain('Subject: Welcome, Kiet!');
    expect(decode(send, 0)).toContain('Hello kiet@gmail.com');
    expect(decode(send, 1)).toContain('To: minh@gmail.com');
    expect(decode(send, 1)).toContain('Subject: Welcome, Minh!');

    const gmailLog = logOf(result.nodeLogs, NodeKeys.GMAIL_SEND);
    expect(jsonOf(gmailLog?.output)).toEqual([
      { to: 'kiet@gmail.com', status: 'sent', message_id: 'm' },
      { to: 'minh@gmail.com', status: 'sent', message_id: 'm' },
    ]);
    expect(result.status).toBe(ExecutionStatus.SUCCESS);
  });

  it('reads data of an earlier node through $node[...] using the paired item', async () => {
    const { run, send } = build(
      chain([
        trigger,
        sheetNode,
        filterNode(),
        gmailNode({
          to: '{{$node["Read Customers"].json.email}}',
          subject: 'Hi {{$json.name}}',
          body: 'Status {{$node["Read Customers"].json.status}}',
        }),
      ]),
    );
    const result = await run();

    expect(result.status).toBe(ExecutionStatus.SUCCESS);
    expect(send).toHaveBeenCalledTimes(2);
    // Minh is row 2 of the sheet but item 1 after the filter.
    expect(decode(send, 1)).toContain('To: minh@gmail.com');
    expect(decode(send, 1)).toContain('Subject: Hi Minh');
    expect(decode(send, 1)).toContain('Status new');
  });

  it('keeps running with no items when the filter removes everything', async () => {
    const { run, send } = build(
      chain([
        trigger,
        sheetNode,
        filterNode('nothing-matches'),
        gmailNode({ subject: 's', body: 'b' }),
      ]),
    );
    const result = await run();

    expect(send).not.toHaveBeenCalled();
    expect(logOf(result.nodeLogs, NodeKeys.GMAIL_SEND)?.output).toEqual([]);
    expect(result.status).toBe(ExecutionStatus.SUCCESS);
  });

  it('stops at the failing item and records how far the node got', async () => {
    const send = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: 'm1' } })
      .mockRejectedValueOnce(new Error('quota exceeded'));
    const rows: Row[] = [
      ['name', 'email', 'status'],
      ['A', 'a@x.com', 'new'],
      ['B', 'b@x.com', 'new'],
      ['C', 'c@x.com', 'new'],
    ];
    const { run } = build(
      chain([trigger, sheetNode, gmailNode({ subject: 's', body: 'b' })]),
      { rows, send },
    );
    const result = await run();
    const gmailLog = logOf(result.nodeLogs, NodeKeys.GMAIL_SEND);

    expect(send).toHaveBeenCalledTimes(2);
    expect(gmailLog?.status).toBe(ExecutionStatus.FAILED);
    expect(gmailLog?.errorMessage).toBe('quota exceeded');
    expect(gmailLog?.output).toEqual({
      total_items: 3,
      processed: 1,
      failed_at_index: 1,
    });
    expect(result.status).toBe(ExecutionStatus.FAILED);
  });

  it('fails the node with a clear message for an unknown node reference', async () => {
    const { run, send } = build(
      chain([
        trigger,
        sheetNode,
        gmailNode({
          to: '{{$node["Missing"].json.email}}',
          subject: 's',
          body: 'b',
        }),
      ]),
    );
    const result = await run();
    const gmailLog = logOf(result.nodeLogs, NodeKeys.GMAIL_SEND);

    expect(send).not.toHaveBeenCalled();
    expect(gmailLog?.status).toBe(ExecutionStatus.FAILED);
    expect(gmailLog?.errorMessage).toContain('Config "to"');
    expect(gmailLog?.errorMessage).toContain('"Missing"');
    expect(gmailLog?.errorMessage).toContain('renamed');
  });

  it('fails the node on an expression with invalid syntax', async () => {
    const { run } = build(
      chain([
        trigger,
        sheetNode,
        gmailNode({ subject: '{{$json.}}', body: 'b' }),
      ]),
    );
    const gmailLog = logOf((await run()).nodeLogs, NodeKeys.GMAIL_SEND);

    expect(gmailLog?.status).toBe(ExecutionStatus.FAILED);
    expect(gmailLog?.errorMessage).toContain('Config "subject"');
  });

  it('does not resolve {{...}} in fields that are not marked as expressions', async () => {
    // Filter "field" is a plain path: a literal "{{status}}" is looked up as-is and matches nothing.
    const { run } = build(
      chain([
        trigger,
        sheetNode,
        {
          id: 'filter',
          data: {
            key: NodeKeys.LOGIC_FILTER,
            name: 'Only New',
            config: { field: '{{status}}', operator: 'equals', value: 'new' },
          },
        },
      ]),
    );
    const filterLog = logOf((await run()).nodeLogs, NodeKeys.LOGIC_FILTER);

    expect(filterLog?.status).toBe(ExecutionStatus.SUCCESS);
    expect(filterLog?.output).toEqual([]);
  });

  it('aggregates every item into one and still allows reading all items of an earlier node', async () => {
    const aggregate = {
      id: 'agg',
      data: { key: NodeKeys.DATA_AGGREGATE, name: 'Gather', config: {} },
    };
    const { run, send } = build(
      chain([
        trigger,
        sheetNode,
        aggregate,
        gmailNode({
          to: 'ops@x.com',
          subject:
            '{{$json.items[0].name}} and {{$node["Read Customers"].all[2].name}}',
          body: 'b',
        }),
      ]),
    );
    const result = await run();

    const aggLog = logOf(result.nodeLogs, NodeKeys.DATA_AGGREGATE);
    expect(aggLog?.output).toEqual([
      {
        json: {
          items: [
            { name: 'Kiet', email: 'kiet@gmail.com', status: 'new' },
            { name: 'An', email: 'an@gmail.com', status: 'contacted' },
            { name: 'Minh', email: 'minh@gmail.com', status: 'new' },
          ],
        },
      },
    ]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(decode(send, 0)).toContain('Subject: Kiet and Minh');
  });

  it('cannot pair an item through an aggregate and explains how to use .all instead', async () => {
    const aggregate = {
      id: 'agg',
      data: { key: NodeKeys.DATA_AGGREGATE, name: 'Gather', config: {} },
    };
    const { run, send } = build(
      chain([
        trigger,
        sheetNode,
        aggregate,
        gmailNode({
          to: '{{$node["Read Customers"].json.email}}',
          subject: 's',
          body: 'b',
        }),
      ]),
    );
    const gmailLog = logOf((await run()).nodeLogs, NodeKeys.GMAIL_SEND);

    expect(send).not.toHaveBeenCalled();
    expect(gmailLog?.status).toBe(ExecutionStatus.FAILED);
    expect(gmailLog?.errorMessage).toContain('.all');
  });

  it('rejects a credential that belongs to another connector', async () => {
    const { run } = build(chain([trigger, sheetNode]), {
      connectorKey: 'openai',
    });
    const result = await run();
    const sheetLog = logOf(result.nodeLogs, NodeKeys.GOOGLE_SHEET_READ_ROWS);

    expect(sheetLog?.status).toBe(ExecutionStatus.FAILED);
    expect(sheetLog?.errorMessage).toContain('"google" connector');
    expect(result.status).toBe(ExecutionStatus.FAILED);
  });

  it('does not leak credentials in node logs', async () => {
    const send = jest
      .fn()
      .mockRejectedValue(new Error('invalid refresh_token test-refresh-token'));
    const { run } = build(
      chain([trigger, sheetNode, gmailNode({ subject: 's', body: 'b' })]),
      { send },
    );
    const result = await run();

    const serialized = JSON.stringify(result.nodeLogs);
    expect(serialized).not.toContain('test-access-token');
    expect(logOf(result.nodeLogs, NodeKeys.GMAIL_SEND)?.errorMessage).toContain(
      '[REDACTED]',
    );
  });

  it('fails when a node key has no executor', async () => {
    const { run } = build(
      chain([
        trigger,
        { id: 'x', data: { key: 'unknown.node', name: 'X', config: {} } },
      ]),
    );
    const result = await run();
    expect(result.status).toBe(ExecutionStatus.FAILED);
    expect(result.nodeLogs[1].errorMessage).toContain('unknown.node');
  });

  it('fails only the node that has no key, without breaking the catalog lookup', async () => {
    // Like the real catalog, a lookup with a non-string key would throw.
    class StrictCatalog extends NodeCatalogPort {
      getConfigSchemas(keys: string[]): Promise<Map<string, unknown>> {
        if (keys.some((key) => typeof key !== 'string')) {
          return Promise.reject(new Error('invalid key in catalog lookup'));
        }
        return new FakeCatalog().getConfigSchemas();
      }
    }
    const { run } = build(
      chain([trigger, { id: 'broken', data: { name: 'Broken', config: {} } }]),
      { catalog: new StrictCatalog() },
    );
    const result = await run();

    expect(result.status).toBe(ExecutionStatus.FAILED);
    expect(result.nodeLogs[0].status).toBe(ExecutionStatus.SUCCESS);
    expect(result.nodeLogs[1].status).toBe(ExecutionStatus.FAILED);
    expect(result.nodeLogs[1].errorMessage).toContain('No executor registered');
  });
});

import {
  NodeReferenceError,
  PairedItemError,
} from '@app/execution/domain/expression/errors';
import { Item } from '@app/execution/domain/models/item';
import {
  buildNodeNameIndex,
  createExpressionContext,
  NodeRun,
} from '@app/execution/domain/entities/run-state';

const item = (json: Record<string, unknown>, pairedItem?: number): Item => ({
  json,
  pairedItem,
});

const nodes = [
  { id: 'trigger', data: { name: 'Start' } },
  { id: 'sheet', data: { name: 'Read Customers' } },
  { id: 'filter', data: { name: 'Only New' } },
  { id: 'agg', data: { name: 'Gather' } },
  { id: 'dupA', data: { name: 'Twin' } },
  { id: 'dupB', data: { name: 'Twin' } },
  { id: 'later', data: { name: 'Later' } },
];
const names = buildNodeNameIndex(nodes);

const sheetOut = [
  item({ email: 'kiet@x.com' }),
  item({ email: 'an@x.com' }),
  item({ email: 'minh@x.com' }),
];
// Filter keeps rows 0 and 2 of the sheet output.
const filterOut = [item(sheetOut[0].json, 0), item(sheetOut[2].json, 2)];

const runs: NodeRun[] = [
  { nodeId: 'trigger', nodeName: 'Start', input: [], output: [item({})] },
  {
    nodeId: 'sheet',
    nodeName: 'Read Customers',
    input: [item({})],
    output: sheetOut,
  },
  {
    nodeId: 'filter',
    nodeName: 'Only New',
    input: sheetOut,
    output: filterOut,
  },
];

const contextFor = (currentIndex: number, usedRuns: NodeRun[] = runs) =>
  createExpressionContext({
    runs: usedRuns,
    names,
    currentItem: usedRuns[usedRuns.length - 1].output[currentIndex],
    currentIndex,
  });

describe('createExpressionContext', () => {
  it('pairs the current item with the matching item of an earlier node', () => {
    // 2nd filter output (index 1) came from sheet row 2.
    expect(contextFor(1).getPairedJson('Read Customers')).toEqual({
      email: 'minh@x.com',
    });
    expect(contextFor(0).getPairedJson('Read Customers')).toEqual({
      email: 'kiet@x.com',
    });
  });

  it('returns the item of the node directly before the current one', () => {
    expect(contextFor(1).getPairedJson('Only New')).toEqual({
      email: 'minh@x.com',
    });
  });

  it('returns every item of a node with getNodeAll', () => {
    expect(contextFor(0).getNodeAll('Read Customers')).toEqual([
      { email: 'kiet@x.com' },
      { email: 'an@x.com' },
      { email: 'minh@x.com' },
    ]);
  });

  it('uses the only item of an earlier node when the chain cannot be followed', () => {
    const aggOut = [item({ items: [] })];
    const withAggregate: NodeRun[] = [
      {
        nodeId: 'trigger',
        nodeName: 'Start',
        input: [],
        output: [item({ text: 'hi' })],
      },
      {
        nodeId: 'sheet',
        nodeName: 'Read Customers',
        input: [item({})],
        output: sheetOut,
      },
      { nodeId: 'agg', nodeName: 'Gather', input: sheetOut, output: aggOut },
    ];
    expect(contextFor(0, withAggregate).getPairedJson('Start')).toEqual({
      text: 'hi',
    });
  });

  it('fails when the pairing chain is broken by a node that does not pair items', () => {
    const aggOut = [item({ items: [] })];
    const withAggregate: NodeRun[] = [
      ...runs,
      { nodeId: 'agg', nodeName: 'Gather', input: filterOut, output: aggOut },
    ];
    const ctx = contextFor(0, withAggregate);
    expect(() => ctx.getPairedJson('Read Customers')).toThrow(PairedItemError);
    expect(() => ctx.getPairedJson('Read Customers')).toThrow(/\.all/);
    expect(ctx.getNodeAll('Read Customers')).toHaveLength(3);
  });

  it('fails with a rename hint for an unknown node name', () => {
    expect(() => contextFor(0).getPairedJson('Nope')).toThrow(
      NodeReferenceError,
    );
    expect(() => contextFor(0).getNodeAll('Nope')).toThrow(/renamed/);
  });

  it('suggests the node name when only case or spacing differs', () => {
    expect(() => contextFor(0).getNodeAll('read  customers')).toThrow(
      'Did you mean "Read Customers"?',
    );
    expect(() => contextFor(0).getNodeAll('Nope')).not.toThrow(/Did you mean/);
  });

  it('fails for a node that exists but has not run yet', () => {
    expect(() => contextFor(0).getPairedJson('Later')).toThrow(/has not run/);
  });

  it('fails for a name shared by several nodes', () => {
    expect(() => contextFor(0).getNodeAll('Twin')).toThrow(/2 nodes/);
  });

  it('fails when the current item index has no counterpart', () => {
    expect(() => contextFor(0).getPairedJson('Read Customers')).not.toThrow();
    const ctx = createExpressionContext({
      runs,
      names,
      currentItem: { json: {} },
      currentIndex: 7,
    });
    expect(() => ctx.getPairedJson('Read Customers')).toThrow(PairedItemError);
  });
});

describe('buildNodeNameIndex', () => {
  it('ignores nodes without a name and groups duplicates', () => {
    const index = buildNodeNameIndex([
      { id: 'a', data: { name: 'X' } },
      { id: 'b', data: {} },
      { id: 'c', data: { name: 'X' } },
    ]);
    expect(index.get('X')).toEqual(['a', 'c']);
    expect(index.size).toBe(1);
  });
});

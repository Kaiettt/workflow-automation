import {
  buildGraphPlan,
  edgeOutput,
} from '@app/execution/domain/entities/workflow-execution.entity';
import {
  FALLBACK_OUTPUT,
  resolveOutputs,
} from '@app/shared/utils/node-outputs';

const node = (id: string) => ({ id, data: { key: 'k' } });
const edge = (source: string, target: string, sourceHandle?: string) => ({
  source,
  target,
  sourceHandle,
});

describe('buildGraphPlan', () => {
  const nodes = ['a', 'b', 'c', 'd'].map(node);

  it('follows a chain stored in order', () => {
    const edges = [edge('a', 'b'), edge('b', 'c'), edge('c', 'd')];
    expect(buildGraphPlan({ nodes, edges }).order).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('follows a chain whose edges were drawn out of order', () => {
    const edges = [edge('c', 'd'), edge('a', 'b'), edge('b', 'c')];
    expect(buildGraphPlan({ nodes, edges }).order).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('allows a node to fan out and orders parents before children', () => {
    const edges = [edge('a', 'b'), edge('a', 'c'), edge('c', 'd')];
    const { order } = buildGraphPlan({ nodes, edges });
    expect(order[0]).toBe('a');
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
    expect(order).toHaveLength(4);
  });

  it('runs a node that joins two branches after both of them', () => {
    const edges = [
      edge('a', 'b'),
      edge('a', 'c'),
      edge('b', 'd'),
      edge('c', 'd'),
    ];
    const plan = buildGraphPlan({ nodes, edges });
    expect(plan.order[3]).toBe('d');
    expect(plan.incoming.get('d')).toHaveLength(2);
    expect(plan.incoming.has('a')).toBe(false);
  });

  it('rejects two start nodes', () => {
    expect(() =>
      buildGraphPlan({ nodes, edges: [edge('a', 'b'), edge('c', 'd')] }),
    ).toThrow(/exactly one start node/);
  });

  it.each([
    ['a cycle with no start', [edge('a', 'b'), edge('b', 'a')]],
    [
      'a cycle behind the start',
      [edge('a', 'b'), edge('b', 'c'), edge('c', 'b')],
    ],
  ])('rejects %s', (_name, edges) => {
    expect(() => buildGraphPlan({ nodes, edges })).toThrow(/cycle/);
  });

  it('rejects an edge that points to a deleted node', () => {
    expect(() => buildGraphPlan({ nodes, edges: [edge('a', 'gone')] })).toThrow(
      /missing node: gone/,
    );
  });

  it('rejects a definition without edges', () => {
    expect(() => buildGraphPlan({ nodes, edges: [] })).toThrow(
      /non-empty edge chain/,
    );
  });
});

describe('edgeOutput', () => {
  it('reads the output from an out:<key> handle and defaults to main', () => {
    expect(edgeOutput(edge('a', 'b', 'out:true'))).toBe('true');
    expect(edgeOutput(edge('a', 'b', 'right-source'))).toBe('main');
    expect(edgeOutput(edge('a', 'b'))).toBe('main');
  });
});

describe('resolveOutputs', () => {
  it('gives a node without x-outputs a single main output', () => {
    expect(resolveOutputs({ type: 'object' }, {}).map((o) => o.key)).toEqual([
      'main',
    ]);
  });

  it('lists static outputs', () => {
    const schema = {
      'x-outputs': {
        static: [
          { key: 'true', label: 'True' },
          { key: 'false', label: 'False' },
        ],
      },
    };
    expect(resolveOutputs(schema, {}).map((o) => o.key)).toEqual([
      'true',
      'false',
    ]);
  });

  it('builds one output per rule plus the fallback', () => {
    const schema = {
      'x-outputs': { fromConfig: 'rules', labelField: 'label', fallback: true },
    };
    const outputs = resolveOutputs(schema, {
      rules: [{ label: 'Price' }, {}],
    });
    expect(outputs).toEqual([
      { key: 'rule_0', label: 'Price' },
      { key: 'rule_1', label: 'Rule 2' },
      { key: FALLBACK_OUTPUT, label: 'Fallback' },
    ]);
  });
});

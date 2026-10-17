import { getExecutionOrder } from '@app/execution/domain/entities/workflow-execution.entity';

const node = (id: string) => ({ id, data: { key: 'k' } });
const edge = (source: string, target: string) => ({ source, target });

describe('getExecutionOrder', () => {
  const nodes = ['a', 'b', 'c', 'd'].map(node);

  it('follows a chain stored in order', () => {
    const edges = [edge('a', 'b'), edge('b', 'c'), edge('c', 'd')];
    expect(getExecutionOrder({ nodes, edges })).toEqual(['a', 'b', 'c', 'd']);
  });

  it('follows a chain whose edges were drawn out of order', () => {
    const edges = [edge('c', 'd'), edge('a', 'b'), edge('b', 'c')];
    expect(getExecutionOrder({ nodes, edges })).toEqual(['a', 'b', 'c', 'd']);
  });

  it.each([
    ['a node with two outgoing edges', [edge('a', 'b'), edge('a', 'c')]],
    ['a node with two incoming edges', [edge('a', 'c'), edge('b', 'c')]],
    ['two separate chains', [edge('a', 'b'), edge('c', 'd')]],
    ['a cycle', [edge('a', 'b'), edge('b', 'a')]],
  ])('rejects %s', (_name, edges) => {
    expect(() => getExecutionOrder({ nodes, edges })).toThrow(
      /single directed chain/,
    );
  });

  it('rejects an edge that points to a deleted node', () => {
    expect(() =>
      getExecutionOrder({ nodes, edges: [edge('a', 'gone')] }),
    ).toThrow(/missing node: gone/);
  });

  it('rejects a definition without edges', () => {
    expect(() => getExecutionOrder({ nodes, edges: [] })).toThrow(
      /non-empty edge chain/,
    );
  });
});

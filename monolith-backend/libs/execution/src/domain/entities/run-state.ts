import { NodeReferenceError, PairedItemError } from '../expression/errors';
import { ExpressionContext } from '../expression/template';
import { Item, ItemJson } from '../models/item';

export interface NodeRun {
  nodeId: string;
  nodeName: string;
  input: Item[];
  output: Item[];
}

// node display name -> ids of the nodes carrying that name
export type NodeNameIndex = ReadonlyMap<string, readonly string[]>;

export function buildNodeNameIndex(
  nodes: ReadonlyArray<{ id: string; data?: Record<string, unknown> }>,
): NodeNameIndex {
  const index = new Map<string, string[]>();
  for (const node of nodes) {
    const name = node.data?.name;
    if (typeof name !== 'string' || name.length === 0) continue;
    index.set(name, [...(index.get(name) ?? []), node.id]);
  }
  return index;
}

function findRunIndex(
  runs: readonly NodeRun[],
  names: NodeNameIndex,
  nodeName: string,
): number {
  const ids = names.get(nodeName);
  if (!ids || ids.length === 0) {
    throw new NodeReferenceError(
      `Node "${nodeName}" was not found - it may have been renamed`,
    );
  }
  if (ids.length > 1) {
    throw new NodeReferenceError(
      `Node name "${nodeName}" is used by ${ids.length} nodes; rename them so the reference is unambiguous`,
    );
  }
  const runIndex = runs.findIndex((run) => run.nodeId === ids[0]);
  if (runIndex === -1) {
    throw new NodeReferenceError(
      `Node "${nodeName}" has not run before this node`,
    );
  }
  return runIndex;
}

// `runs` are the nodes that already ran, in order; the node being executed
// received `runs[last].output` as input. `currentIndex` is the position of the
// current item in that input.
export function createExpressionContext(params: {
  runs: readonly NodeRun[];
  names: NodeNameIndex;
  currentItem: Item;
  currentIndex: number;
}): ExpressionContext {
  const { runs, names, currentItem, currentIndex } = params;

  return {
    currentItem,

    getNodeAll(nodeName: string): ItemJson[] {
      return runs[findRunIndex(runs, names, nodeName)].output.map(
        (item) => item.json,
      );
    },

    getPairedJson(nodeName: string): ItemJson {
      const targetPos = findRunIndex(runs, names, nodeName);
      let index = currentIndex;
      for (let pos = runs.length - 1; pos >= targetPos; pos -= 1) {
        const item = runs[pos].output[index];
        if (item === undefined) {
          throw new PairedItemError(
            `There is no item to pair with node "${nodeName}"`,
          );
        }
        if (pos === targetPos) return item.json;
        if (item.pairedItem === undefined) {
          throw new PairedItemError(
            `Cannot tell which item of node "${nodeName}" matches the current item. Use $node["${nodeName}"].all to read all of its items`,
          );
        }
        index = item.pairedItem;
      }
      throw new PairedItemError(
        `There is no item to pair with node "${nodeName}"`,
      );
    },
  };
}

import { NodeReferenceError, PairedItemError } from '../expression/errors';
import { ExpressionContext } from '../expression/template';
import { Item, ItemJson } from '../models/item';

// Where an input item came from: `index` is its position in the `output` of node `nodeId`.
export interface ItemSource {
  nodeId: string;
  index: number;
}

export interface NodeRun {
  nodeId: string;
  nodeName: string;
  input: Item[];
  // Parallel to `input`. Without it the input is taken to be the output of the
  // run before this one (a plain chain).
  inputSources?: ItemSource[];
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

const normalizeName = (name: string) =>
  name.replace(/\s+/g, ' ').trim().toLowerCase();

// A node name that differs only in case or spacing from the one typed.
function nearestName(names: NodeNameIndex, typed: string): string | undefined {
  const wanted = normalizeName(typed);
  for (const name of names.keys()) {
    if (normalizeName(name) === wanted) return name;
  }
  return undefined;
}

function findRunIndex(
  runs: readonly NodeRun[],
  names: NodeNameIndex,
  nodeName: string,
): number {
  const ids = names.get(nodeName);
  if (!ids || ids.length === 0) {
    const suggestion = nearestName(names, nodeName);
    throw new NodeReferenceError(
      `Node "${nodeName}" was not found - it may have been renamed` +
        (suggestion ? `. Did you mean "${suggestion}"?` : ''),
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

// `runs` are the nodes that already ran, parents before children. `currentIndex`
// is the position of the current item in the input of the node being executed;
// `currentSources` says where that input came from (without it, from the last run).
export function createExpressionContext(params: {
  runs: readonly NodeRun[];
  names: NodeNameIndex;
  currentItem: Item;
  currentIndex: number;
  currentSources?: readonly ItemSource[];
}): ExpressionContext {
  const { runs, names, currentItem, currentIndex, currentSources } = params;

  return {
    currentItem,

    getNodeAll(nodeName: string): ItemJson[] {
      return runs[findRunIndex(runs, names, nodeName)].output.map(
        (item) => item.json,
      );
    },

    getPairedJson(nodeName: string): ItemJson {
      const targetPos = findRunIndex(runs, names, nodeName);
      const noItem = () =>
        new PairedItemError(`There is no item to pair with node "${nodeName}"`);
      const last = runs[runs.length - 1];
      // Walk from the current item back through the nodes that produced it.
      let source: ItemSource | undefined =
        currentSources?.[currentIndex] ??
        (last ? { nodeId: last.nodeId, index: currentIndex } : undefined);
      while (source) {
        const sourceNodeId: string = source.nodeId;
        const pos = runs.findIndex((run) => run.nodeId === sourceNodeId);
        const item = pos === -1 ? undefined : runs[pos].output[source.index];
        if (item === undefined) throw noItem();
        if (pos === targetPos) return item.json;
        if (item.pairedItem === undefined) {
          // A node that ran once has nothing to pair: its only item is the one meant.
          if (runs[targetPos].output.length === 1) {
            return runs[targetPos].output[0].json;
          }
          throw new PairedItemError(
            `Cannot tell which item of node "${nodeName}" matches the current item. Use $node["${nodeName}"].all to read all of its items`,
          );
        }
        const run = runs[pos];
        const parent: NodeRun | undefined = runs[pos - 1];
        source =
          run.inputSources?.[item.pairedItem] ??
          (parent
            ? { nodeId: parent.nodeId, index: item.pairedItem }
            : undefined);
      }
      throw noItem();
    },
  };
}

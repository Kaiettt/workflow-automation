import { useDesignerStore } from '../store/designer.store';
import { NodeIcon } from './nodes/NodeIcon';

const CATEGORY_ORDER = ['TRIGGER', 'LOGIC', 'DATA_PROCESSING', 'INTEGRATION', 'AI'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  TRIGGER: 'Triggers',
  LOGIC: 'Logic',
  DATA_PROCESSING: 'Data',
  INTEGRATION: 'Integrations',
  AI: 'AI',
};

export function Sidebar() {
  const nodeTypes = useDesignerStore((state) => state.nodeTypes);

  const onDragStart = (event: React.DragEvent, nodeType: string, nodeName: string, nodeKey: string) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    event.dataTransfer.setData('application/reactflow/name', nodeName);
    event.dataTransfer.setData('application/reactflow/key', nodeKey);
    event.dataTransfer.effectAllowed = 'move';
  };

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    nodes: nodeTypes.filter((node) => node.category === category),
  })).filter((group) => group.nodes.length > 0);

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10">
      <div className="p-4 border-b border-gray-200 font-semibold text-gray-700">
        Nodes
      </div>
      <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
        {groups.map(({ category, nodes }) => (
          <section key={category} className="flex flex-col gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              {CATEGORY_LABELS[category]}
            </h3>
            {nodes.map((node) => (
              <div
                key={node.key}
                className="p-3 border rounded-md cursor-grab active:cursor-grabbing hover:bg-gray-50 transition-colors text-sm shadow-sm flex items-center gap-3 bg-white"
                style={{ borderColor: node.color || '#e5e7eb' }}
                onDragStart={(event) =>
                  onDragStart(
                    event,
                    node.category === 'TRIGGER' ? 'triggerNode' : 'actionNode',
                    node.displayName,
                    node.key,
                  )
                }
                draggable
              >
                <NodeIcon icon={node.icon} name={node.displayName} color={node.color || '#6b7280'} />
                <span className="font-medium text-gray-700">{node.displayName}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}

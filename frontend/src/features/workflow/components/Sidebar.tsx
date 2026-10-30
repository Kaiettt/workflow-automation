import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
  const [query, setQuery] = useState('');

  const onDragStart = (event: React.DragEvent, nodeType: string, nodeName: string, nodeKey: string) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    event.dataTransfer.setData('application/reactflow/name', nodeName);
    event.dataTransfer.setData('application/reactflow/key', nodeKey);
    event.dataTransfer.effectAllowed = 'move';
  };

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    nodes: nodeTypes.filter(
      (node) =>
        node.category === category &&
        `${node.displayName} ${node.description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()),
    ),
  })).filter((group) => group.nodes.length > 0);

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10">
      <div className="space-y-3 border-b border-gray-200 p-4">
        <p className="font-semibold text-gray-700">Nodes</p>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes"
            aria-label="Search nodes"
            className="pl-8"
          />
        </div>
      </div>
      <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
        {groups.length === 0 && (
          <p className="text-sm text-gray-500">No node matches “{query}”.</p>
        )}
        {groups.map(({ category, nodes }) => (
          <section key={category} className="flex flex-col gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              {CATEGORY_LABELS[category]}
            </h3>
            {nodes.map((node) => (
              <div
                key={node.key}
                className="p-2.5 border border-gray-200 rounded-lg cursor-grab active:cursor-grabbing hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm transition-all text-sm flex items-center gap-3 bg-white"
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
                <span className="min-w-0 font-medium leading-tight text-gray-700">{node.displayName}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}

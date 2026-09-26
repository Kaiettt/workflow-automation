import { useDesignerStore } from '../store/designer.store';

import { Play, Settings } from 'lucide-react';

export function Sidebar() {
  const nodeTypes = useDesignerStore((state) => state.nodeTypes);

  const onDragStart = (event: React.DragEvent, nodeType: string, nodeName: string, nodeKey: string) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    event.dataTransfer.setData('application/reactflow/name', nodeName);
    event.dataTransfer.setData('application/reactflow/key', nodeKey);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10">
      <div className="p-4 border-b border-gray-200 font-semibold text-gray-700">
        Nodes
      </div>
      <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1">
        {nodeTypes.map((node) => (
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
            {node.icon?.startsWith('http') ? (
              <img src={node.icon} alt={node.displayName} className="w-5 h-5 object-contain" />
            ) : node.icon === 'play' ? (
              <Play className="w-5 h-5" style={{ color: node.color || '#6b7280' }} />
            ) : (
              <Settings className="w-5 h-5 text-gray-500" />
            )}
            <span className="font-medium text-gray-700">{node.displayName}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

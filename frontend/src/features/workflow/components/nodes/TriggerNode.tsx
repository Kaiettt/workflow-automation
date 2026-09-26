import { Handle, Position } from '@xyflow/react';
import { useDesignerStore } from '../../store/designer.store';
import { Play, Settings } from 'lucide-react';

interface NodeProps {
  data: {
    name: string;
    key: string;
    config?: Record<string, unknown>;
  };
}

export function TriggerNode({ data }: NodeProps) {
  const nodeTypes = useDesignerStore((state) => state.nodeTypes);
  const nodeType = nodeTypes.find((t) => t.key === data.key);
  const color = nodeType?.color || '#6b7280'; // default gray

  return (
    <div 
      className="flex flex-col bg-white border-2 rounded-lg shadow-sm w-48 overflow-hidden transition-all hover:shadow-md"
      style={{ borderColor: color }}
    >
      <div 
        className="text-white font-semibold px-3 py-1.5 text-xs uppercase tracking-wider"
        style={{ backgroundColor: color }}
      >
        Trigger
      </div>
      <div className="p-3 text-sm text-gray-700 flex items-center gap-3">
        {nodeType?.icon?.startsWith('http') ? (
          <img src={nodeType.icon} alt={data.name} className="w-5 h-5 object-contain" />
        ) : nodeType?.icon === 'play' ? (
          <Play className="w-5 h-5" style={{ color }} />
        ) : (
          <Settings className="w-5 h-5 text-gray-500" />
        )}
        <span className="font-medium truncate">{data.name}</span>
      </div>

      {/* 4-sided Handles */}
      <Handle type="target" position={Position.Top} id="top-target" className="w-3 h-3 bg-gray-400" />
      <Handle type="source" position={Position.Top} id="top-source" className="w-3 h-3 bg-gray-400" />
      
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="w-3 h-3 bg-gray-400" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="w-3 h-3 bg-gray-400" />
      
      <Handle type="target" position={Position.Left} id="left-target" className="w-3 h-3 bg-gray-400" />
      <Handle type="source" position={Position.Left} id="left-source" className="w-3 h-3 bg-gray-400" />
      
      <Handle type="target" position={Position.Right} id="right-target" className="w-3 h-3 bg-gray-400" />
      <Handle type="source" position={Position.Right} id="right-source" className="w-3 h-3 bg-gray-400" />
    </div>
  );
}

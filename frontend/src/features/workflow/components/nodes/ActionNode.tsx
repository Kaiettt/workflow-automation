import { Handle, Position } from '@xyflow/react';
import { useDesignerStore } from '../../store/designer.store';
import { NodeIcon } from './NodeIcon';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

interface NodeProps {
  id?: string;
  data: {
    name: string;
    key: string;
    config?: Record<string, unknown>;
  };
}

export function ActionNode({ id, data }: NodeProps) {
  const nodeTypes = useDesignerStore((state) => state.nodeTypes);
  const validationIssues = useDesignerStore((state) => state.validationIssues);
  const nodeType = nodeTypes.find((t) => t.key === data.key);
  const color = nodeType?.color || '#3b82f6'; // default blue

  const errorCount = id
    ? validationIssues.filter((i) => i.nodeId === id).length
    : 0;

  return (
    <div className="relative group">
      {/* Red badge showing error count */}
      {errorCount > 0 && (
        <div
          title={`${errorCount} issue${errorCount > 1 ? 's' : ''} require attention`}
          className="absolute -top-2.5 -right-2.5 z-30 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-white animate-in zoom-in-75"
        >
          {errorCount}
        </div>
      )}

      <div
        className={cn(
          'flex flex-col bg-white border-2 rounded-lg shadow-sm w-48 overflow-hidden transition-all hover:shadow-md',
          errorCount > 0 && 'ring-2 ring-rose-500/80 ring-offset-2',
        )}
        style={{ borderColor: errorCount > 0 ? '#f43f5e' : color }}
      >
        <div
          className="text-white font-semibold px-3 py-1.5 text-xs uppercase tracking-wider flex items-center justify-between"
          style={{ backgroundColor: errorCount > 0 ? '#e11d48' : color }}
        >
          <span>Action</span>
          {errorCount > 0 && <AlertCircle className="size-3.5 text-white/90" />}
        </div>
        <div className="p-3 text-sm text-gray-700 flex items-center gap-3">
          <NodeIcon icon={nodeType?.icon} name={data.name} color={color} />
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
    </div>
  );
}

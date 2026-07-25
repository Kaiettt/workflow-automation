import { Handle, Position } from '@xyflow/react';

interface NodeProps {
  data: {
    name: string;
    icon?: string;
  };
}

export function ActionNode({ data }: NodeProps) {
  return (
    <div className="flex flex-col bg-white border-2 border-gray-300 rounded-lg shadow-sm w-48 overflow-hidden">
      <div className="bg-gray-100 border-b border-gray-200 text-gray-600 font-semibold px-3 py-1 text-sm uppercase">
        Action
      </div>
      <div className="p-3 text-sm text-gray-700 flex items-center gap-2">
        <span>{data.name}</span>
      </div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-gray-400" />
    </div>
  );
}

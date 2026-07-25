import { Handle, Position } from '@xyflow/react';

interface NodeProps {
  data: {
    name: string;
    icon?: string;
  };
}

export function TriggerNode({ data }: NodeProps) {
  return (
    <div className="flex flex-col bg-blue-50 border-2 border-blue-400 rounded-lg shadow-sm w-48 overflow-hidden">
      <div className="bg-blue-400 text-white font-semibold px-3 py-1 text-sm uppercase">
        Trigger
      </div>
      <div className="p-3 text-sm text-gray-700 flex items-center gap-2">
        <span>{data.name}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500" />
    </div>
  );
}

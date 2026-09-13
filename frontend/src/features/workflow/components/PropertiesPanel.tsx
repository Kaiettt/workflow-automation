import { useState } from 'react';
import { useDesignerStore } from '../store/designer.store';
import type { Node } from '@xyflow/react';

interface PropertiesPanelProps {
  nodes: Node[];
  onNodeDataChange: (nodeId: string, data: unknown) => void;
}

export function PropertiesPanel({ nodes, onNodeDataChange }: PropertiesPanelProps) {
  const selectedNodeId = useDesignerStore((state) => state.selectedNodeId);
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>(() => {
    return (selectedNode?.data?.config as Record<string, unknown>) || {};
  });
  const [prevNodeId, setPrevNodeId] = useState<string | null>(selectedNodeId);

  if (selectedNodeId !== prevNodeId) {
    setPrevNodeId(selectedNodeId);
    setLocalConfig((selectedNode?.data?.config as Record<string, unknown>) || {});
  }

  if (!selectedNode) {
    return (
      <aside className="w-80 bg-white border-l border-gray-200 p-4 h-full shadow-sm z-10 flex flex-col">
        <div className="text-gray-500 text-sm italic text-center mt-10">
          Select a node to view its properties.
        </div>
      </aside>
    );
  }

  const handleConfigChange = (key: string, value: string) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    onNodeDataChange(selectedNode.id, { ...selectedNode.data, config: newConfig });
  };

  return (
    <aside className="w-80 bg-white border-l border-gray-200 h-full shadow-sm z-10 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 text-lg">{selectedNode.data?.name as string}</h3>
        <p className="text-xs text-gray-500 uppercase tracking-wider">{selectedNode.type}</p>
      </div>
      
      <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
        {selectedNode.type === 'triggerNode' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Cron Expression</label>
            <input 
              type="text" 
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              value={(localConfig.cron as string) || ''} 
              onChange={(e) => handleConfigChange('cron', e.target.value)} 
              placeholder="0 7 * * *"
            />
          </div>
        )}

        {selectedNode.type === 'actionNode' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Settings</label>
            <textarea 
              className="w-full border border-gray-300 rounded-md p-2 text-sm h-32 focus:ring-blue-500 focus:border-blue-500 font-mono"
              value={(localConfig.settings as string) || ''} 
              onChange={(e) => handleConfigChange('settings', e.target.value)}
              placeholder="{}"
            />
          </div>
        )}
      </div>
    </aside>
  );
}

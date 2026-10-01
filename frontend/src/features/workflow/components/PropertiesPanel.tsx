import React, { useState, useEffect, useCallback } from 'react';
import { useDesignerStore } from '../store/designer.store';
import type { Node } from '@xyflow/react';
import { apiClient } from '../../../shared/api/http-client';

interface PropertiesPanelProps {
  nodes: Node[];
  onNodeDataChange: (nodeId: string, data: Record<string, unknown>) => void;
}

export function PropertiesPanel({ nodes, onNodeDataChange }: PropertiesPanelProps) {
  const selectedNodeId = useDesignerStore((state) => state.selectedNodeId);
  const nodeTypes = useDesignerStore((state) => state.nodeTypes);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const nodeType = selectedNode ? nodeTypes.find((t) => t.key === selectedNode.data?.key) : null;

  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>(() => {
    return (selectedNode?.data?.config as Record<string, unknown>) || {};
  });
  const [prevNodeId, setPrevNodeId] = useState<string | null>(selectedNodeId);

  if (selectedNodeId !== prevNodeId) {
    setPrevNodeId(selectedNodeId);
    setLocalConfig((selectedNode?.data?.config as Record<string, unknown>) || {});
  }

  const handleConfigChange = useCallback((key: string, value: string) => {
    if (!selectedNode) return;
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    onNodeDataChange(selectedNode.id, { ...selectedNode.data, config: newConfig });
  }, [selectedNode, localConfig, onNodeDataChange]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'oauth-success') {
        const properties = nodeType?.configSchema?.properties as Record<string, unknown> | undefined;
        const currentKey = Object.keys(properties || {}).find(
          k => (properties![k] as Record<string, unknown>)['x-connectorKey']
        );
        if (currentKey && event.data.credentialId) {
          handleConfigChange(currentKey, event.data.credentialId);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [nodeType, handleConfigChange]);

  if (!selectedNode || !nodeType) {
    return (
      <aside className="w-80 bg-white border-l border-gray-200 p-4 h-full shadow-sm z-10 flex flex-col">
        <div className="text-gray-500 text-sm italic text-center mt-10">
          Select a node to view its properties.
        </div>
      </aside>
    );
  }

  const handleConnect = async () => {
    try {
      const res = await apiClient.get('/api/integrations/google/auth');
      if (res.data.url) {
        window.open(res.data.url, 'OAuth', 'width=500,height=600');
      }
    } catch (e) {
      console.error('Failed to initiate OAuth', e);
    }
  };

  const renderField = (key: string, schema: Record<string, unknown>): React.ReactNode => {
    const value = (localConfig[key] as string) || '';

    // 1. Connection Button
    if (schema['x-connectorKey']) {
      return (
        <div key={key} className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 capitalize">
            {key.replace(/_/g, ' ')}
          </label>
          <button
            className="w-full bg-blue-50 text-blue-600 border border-blue-200 rounded-md py-2 text-sm font-medium hover:bg-blue-100 transition-colors"
            onClick={() => handleConnect()}
          >
            Connect {schema['x-connectorKey'] as string}
          </button>
          {value && <div className="text-xs text-green-600 mt-1">✓ Connected</div>}
        </div>
      );
    }

    // 2. Enum Dropdown
    if (schema.enum && Array.isArray(schema.enum)) {
      return (
        <div key={key} className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 capitalize">
            {key.replace(/_/g, ' ')}
          </label>
          <select
            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
            value={value}
            onChange={(e) => handleConfigChange(key, e.target.value)}
          >
            <option value="" disabled>Select {key}</option>
            {schema.enum.map((opt: string) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );
    }

    // 3. Standard Text Input (with Expression support)
    const isExpression = schema['x-allowExpression'] === true;
    return (
      <div key={key} className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-medium text-gray-700 capitalize">
            {key.replace(/_/g, ' ')}
          </label>
          {isExpression && (
            <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-mono border border-purple-200">
              fx
            </span>
          )}
        </div>
        <input
          type="text"
          className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          value={value}
          onChange={(e) => handleConfigChange(key, e.target.value)}
          placeholder={isExpression ? "{{nodeId.output}}" : `Enter ${key}`}
        />
      </div>
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties = (nodeType.configSchema as any)?.properties || {};

  return (
    <aside className="w-80 bg-white border-l border-gray-200 h-full shadow-sm z-10 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 text-lg truncate">{selectedNode.data?.name as string}</h3>
        <p className="text-xs text-gray-500 uppercase tracking-wider">{nodeType.displayName}</p>
      </div>

      <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
        {Object.keys(properties).length === 0 ? (
          <div className="text-sm text-gray-500 italic">No configuration required.</div>
        ) : (
          Object.entries(properties)
            .filter(([key]) => key !== 'input_schema' && key !== 'output_schema')
            .map(([key, schema]) => renderField(key, schema as Record<string, unknown>))
        )}
      </div>
    </aside>
  );
}

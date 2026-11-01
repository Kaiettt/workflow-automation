import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDesignerStore } from '../store/designer.store';
import type { Node } from '@xyflow/react';
import { apiClient } from '../../../shared/api/http-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  dependentKeys,
  getProperties,
  isDuplicateNodeName,
  orderedProperties,
} from '../utils/node-config';
import { ConfigField } from './config-fields/ConfigField';
import { WebhookUrlField } from './config-fields/WebhookUrlField';
import { TestEventPanel } from './TestEventPanel';
import { triggerService } from '../services/trigger.service';

interface PropertiesPanelProps {
  workflowId: string;
  nodes: Node[];
  onNodeDataChange: (nodeId: string, data: Record<string, unknown>) => void;
  onDeleteNode: (nodeId: string) => void;
}

const PANEL_CLASS =
  'w-80 bg-white border-l border-gray-200 h-full shadow-sm z-10 flex flex-col';

export function PropertiesPanel({
  workflowId,
  nodes,
  onNodeDataChange,
  onDeleteNode,
}: PropertiesPanelProps) {
  const selectedNodeId = useDesignerStore((state) => state.selectedNodeId);
  const nodeTypes = useDesignerStore((state) => state.nodeTypes);
  const isSaving = useDesignerStore((state) => state.isSaving);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const nodeType = selectedNode ? nodeTypes.find((t) => t.key === selectedNode.data?.key) : null;
  // Stable between renders so the OAuth message listener is not re-attached each time.
  const properties = useMemo(() => getProperties(nodeType?.configSchema), [nodeType]);

  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>(() => {
    return (selectedNode?.data?.config as Record<string, unknown>) || {};
  });
  const [prevNodeId, setPrevNodeId] = useState<string | null>(selectedNodeId);

  if (selectedNodeId !== prevNodeId) {
    setPrevNodeId(selectedNodeId);
    setLocalConfig((selectedNode?.data?.config as Record<string, unknown>) || {});
  }

  // `undefined` removes the key. Fields that depend on this one (a credential
  // picked for a provider) are cleared, as their old value no longer applies.
  const handleConfigChange = useCallback(
    (key: string, value: unknown) => {
      if (!selectedNode) return;
      const newConfig = { ...localConfig };
      if (value === undefined) delete newConfig[key];
      else newConfig[key] = value;
      if (value !== localConfig[key]) {
        for (const dependent of dependentKeys(nodeType?.configSchema, key)) {
          delete newConfig[dependent];
        }
      }
      setLocalConfig(newConfig);
      onNodeDataChange(selectedNode.id, { ...selectedNode.data, config: newConfig });
    },
    [selectedNode, localConfig, nodeType, onNodeDataChange],
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'oauth-success') {
        const currentKey = Object.keys(properties).find(
          (k) => properties[k]['x-connectorKey'] && properties[k]['x-credentialInput'] !== 'form',
        );
        if (currentKey && event.data.credentialId) {
          handleConfigChange(currentKey, event.data.credentialId);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [properties, handleConfigChange]);

  if (!selectedNode || !nodeType) {
    return (
      <aside className={`${PANEL_CLASS} p-4`}>
        <div className="text-gray-500 text-sm italic text-center mt-10">
          Select a node to view its properties.
        </div>
      </aside>
    );
  }

  const nodeName = String(selectedNode.data?.name ?? '');
  const nameIsDuplicate = isDuplicateNodeName(nodes, selectedNode.id, nodeName);

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


  const fields = orderedProperties(nodeType.configSchema).filter(
    ([key]) => key !== 'input_schema' && key !== 'output_schema',
  );
  // Trigger nodes of integration packages receive events from outside.
  const webhook = triggerService.webhookHint(nodeType.configSchema);
  const required = nodeType.configSchema?.required;
  const needsCredential = Array.isArray(required) && required.includes('credential_id');

  return (
    <aside className={PANEL_CLASS}>
      <div className="p-4 border-b border-gray-200">
        <p className="text-xs text-gray-500 uppercase tracking-wider">{nodeType.displayName}</p>
        <Label htmlFor="node-name" className="mt-2 mb-1.5">
          Name
        </Label>
        <Input
          id="node-name"
          value={nodeName}
          onChange={(e) =>
            onNodeDataChange(selectedNode.id, { ...selectedNode.data, name: e.target.value })
          }
          aria-invalid={nameIsDuplicate}
        />
        {nameIsDuplicate && (
          <p className="text-xs text-amber-600 mt-1.5">
            Another node already uses this name, so {'$node["' + nodeName + '"]'} is ambiguous.
            Rename one of them.
          </p>
        )}
      </div>

      <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
        {webhook?.scope === 'node' && (
          <WebhookUrlField workflowId={workflowId} nodeId={selectedNode.id} />
        )}
        {fields.length === 0 && !webhook ? (
          <div className="text-sm text-gray-500 italic">No configuration required.</div>
        ) : (
          fields.map(([key, schema]) => (
            <ConfigField
              key={key}
              nodeKey={nodeType.key}
              fieldKey={key}
              schema={schema}
              config={localConfig}
              needsCredential={needsCredential}
              onChange={handleConfigChange}
              onConnectOAuth={() => void handleConnect()}
            />
          ))
        )}
        {webhook && (
          <TestEventPanel
            key={selectedNode.id}
            workflowId={workflowId}
            nodeId={selectedNode.id}
            draftSaving={isSaving}
          />
        )}
      </div>

      <div className="p-4 border-t border-gray-200">
        <Button
          type="button"
          variant="destructive"
          className="w-full"
          onClick={() => onDeleteNode(selectedNode.id)}
        >
          Delete node
        </Button>
      </div>
    </aside>
  );
}

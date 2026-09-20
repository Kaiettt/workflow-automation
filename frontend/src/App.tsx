import { useState } from 'react';
import { workflowService } from './features/workflow/services/workflow.service';
import { DesignerPage } from './features/workflow/pages/DesignerPage';
import { HomePage } from './features/home/pages/HomePage';
import './App.css';

import type { Node, Edge } from '@xyflow/react';

function App() {
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreateWorkflow = async (
    _templateName?: string,
    initialDefinition?: { nodes: Node[]; edges: Edge[] }
  ) => {
    try {
      setLoading(true);
      const id = await workflowService.createWorkflow();
      if (initialDefinition) {
        await workflowService.saveDraft(id, {
          nodes: initialDefinition.nodes,
          edges: initialDefinition.edges,
          viewport: { x: 0, y: 0, zoom: 1 },
        });
      }
      setWorkflowId(id);
    } catch (error) {
      console.error('Failed to create workflow', error);
      alert('Error creating workflow. Please ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  if (workflowId) {
    return <DesignerPage workflowId={workflowId} onBack={() => setWorkflowId(null)} />;
  }

  return <HomePage onCreateWorkflow={handleCreateWorkflow} loading={loading} />;
}

export default App;

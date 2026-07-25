import { useState } from 'react';
import { workflowService } from './features/workflow/services/workflow.service';
import { DesignerPage } from './features/workflow/pages/DesignerPage';
import './App.css';
import { Button } from '@/components/ui/button'; // Assuming we have shadcn button

function App() {
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreateWorkflow = async () => {
    try {
      setLoading(true);
      const id = await workflowService.createWorkflow();
      setWorkflowId(id);
    } catch (error) {
      console.error('Failed to create workflow', error);
      alert('Error creating workflow');
    } finally {
      setLoading(false);
    }
  };

  if (workflowId) {
    return <DesignerPage workflowId={workflowId} onBack={() => setWorkflowId(null)} />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
            FlowPilot
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Design and automate your workflows with ease.
          </p>
        </div>
        
        <div className="pt-8">
          <Button 
            onClick={handleCreateWorkflow} 
            disabled={loading}
            className="w-full text-lg py-6"
          >
            {loading ? 'Creating...' : 'Create New Workflow'}
          </Button>
        </div>
      </div>
    </main>
  );
}

export default App;

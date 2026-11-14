import { useState } from 'react';
import { AdminGuard } from './features/admin/components/AdminGuard';
import { AdminLayout } from './features/admin/components/AdminLayout';
import { AuthCacheBoundary } from './features/admin/components/AuthCacheBoundary';
import { UsersPage } from './features/admin/pages/UsersPage';
import { UserDetailPage } from './features/admin/pages/UserDetailPage';
import { DashboardPage } from './features/admin/pages/DashboardPage';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { HomePage } from './features/home/pages/HomePage';
import { DesignerPage } from './features/workflow/pages/DesignerPage';
import { WorkflowListPage } from './features/workflow/pages/WorkflowListPage';
import { VersionListPage } from './features/workflow/pages/VersionListPage';
import { VersionDetailPage } from './features/workflow/pages/VersionDetailPage';
import { workflowService } from './features/workflow/services/workflow.service';
import './App.css';
import type { Node, Edge } from '@xyflow/react';

function HomePageWrapper() {
  const navigate = useNavigate();
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
      navigate(`/workflows/${id}`);
    } catch (error) {
      console.error('Failed to create workflow', error);
      alert('Error creating workflow. Please ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return <HomePage onCreateWorkflow={handleCreateWorkflow} loading={loading} />;
}

function LegacyWorkflowRedirect() {
  const params = new URLSearchParams(window.location.search);
  const legacyWorkflowId = params.get('workflowId');
  if (legacyWorkflowId) {
    return <Navigate to={`/workflows/${legacyWorkflowId}`} replace />;
  }
  return <HomePageWrapper />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthCacheBoundary />
      <Routes>
        <Route element={<AdminGuard />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id" element={<UserDetailPage />} />
          </Route>
        </Route>
        <Route path="/" element={<LegacyWorkflowRedirect />} />
        <Route path="/workflows" element={<WorkflowListPage />} />
        <Route path="/workflows/:workflowId" element={<DesignerPage />} />
        <Route path="/workflows/:workflowId/versions" element={<VersionListPage />} />
        <Route path="/workflows/:workflowId/versions/:versionId" element={<VersionDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

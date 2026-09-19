import React from 'react';
import { Navbar } from '../components/Navbar';
import { WorkflowCanvasPreview } from '../components/WorkflowCanvasPreview';
import { TemplateGrid } from '../components/TemplateGrid';
import { FeaturesSection } from '../components/FeaturesSection';
import { Footer } from '../components/Footer';
import { Button } from '@/components/ui/button';
import { Plus, ArrowRight } from 'lucide-react';

import type { Node, Edge } from '@xyflow/react';

interface HomePageProps {
  onCreateWorkflow: (templateName?: string, initialDefinition?: { nodes: Node[]; edges: Edge[] }) => void;
  loading?: boolean;
}

export const HomePage: React.FC<HomePageProps> = ({
  onCreateWorkflow,
  loading,
}) => {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* 1. Navbar */}
      <Navbar onCreateWorkflow={() => onCreateWorkflow()} loading={loading} />

      {/* 2. Hero Section */}
      <section className="pt-14 pb-16 sm:pt-20 sm:pb-24 border-b border-border bg-gradient-to-b from-muted/20 to-transparent">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-mono text-muted-foreground mb-6">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span>FlowPilot v1.0 • Workflow Orchestration Engine</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground max-w-4xl mx-auto leading-tight">
            Visual workflow automation for modern applications.
          </h1>

          {/* Subtitle */}
          <p className="mt-5 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Build, test, and run automated pipelines connecting webhooks, databases, and APIs. Drag-and-drop simplicity with developer-grade reliability.
          </p>

          {/* Actions */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => onCreateWorkflow()}
              disabled={loading}
              className="w-full sm:w-auto rounded-lg bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 px-5 py-2.5 h-10 text-xs font-medium shadow-sm transition-all"
            >
              <Plus className="size-4 mr-1.5" />
              <span>{loading ? 'Creating Workflow...' : 'Create New Workflow'}</span>
              <ArrowRight className="size-3.5 ml-1.5" />
            </Button>

            <a
              href="#templates"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted px-4 py-2.5 h-10 text-xs font-medium text-foreground transition-colors"
            >
              Browse Templates
            </a>
          </div>

          {/* 3. Interactive Canvas Preview */}
          <div className="mt-12 sm:mt-16">
            <WorkflowCanvasPreview 
              onOpenInDesigner={(nodes, edges) => onCreateWorkflow('Order Processing Demo', { nodes, edges })}
              loading={loading}
            />
          </div>

        </div>
      </section>

      {/* 4. Templates */}
      <TemplateGrid 
        onSelectTemplate={(name) => onCreateWorkflow(name)} 
        loading={loading} 
      />

      {/* 5. Core Engine Features */}
      <FeaturesSection />

      {/* 6. Footer */}
      <Footer />
    </div>
  );
};

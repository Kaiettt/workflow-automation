import React from 'react';
import { 
  Plus, 
  Database, 
  Clock, 
  Activity, 
  Layers, 
  ArrowRight
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  connectors: string[];
  icon: React.ComponentType<{ className?: string }>;
}

const TEMPLATES: Template[] = [
  {
    id: 'stripe-to-postgres',
    name: 'Stripe Webhook to PostgreSQL',
    category: 'Billing',
    description: 'Listen for invoice.paid events, validate HMAC signature, and insert transaction records into Postgres.',
    connectors: ['Webhook', 'PostgreSQL'],
    icon: Database,
  },
  {
    id: 'cron-db-cleanup',
    name: 'Scheduled Database Cleanup',
    category: 'Maintenance',
    description: 'Daily cron job executing maintenance queries and archiving stale workflow execution logs.',
    connectors: ['Cron', 'PostgreSQL', 'Gmail'],
    icon: Clock,
  },
  {
    id: 'api-5xx-alert',
    name: 'HTTP 5xx Alert to Ops',
    category: 'Monitoring',
    description: 'Poll external endpoints every 5 minutes. If status >= 500, extract response body and notify team.',
    connectors: ['HTTP', 'Gmail'],
    icon: Activity,
  },
  {
    id: 'redis-cache-sync',
    name: 'Postgres to Redis Cache Sync',
    category: 'Data Sync',
    description: 'Detect updated product records in PostgreSQL and invalidate matching keys in Redis cache.',
    connectors: ['PostgreSQL', 'Redis'],
    icon: Layers,
  },
];

interface TemplateGridProps {
  onSelectTemplate: (templateName: string) => void;
  loading?: boolean;
}

export const TemplateGrid: React.FC<TemplateGridProps> = ({
  onSelectTemplate,
  loading,
}) => {
  return (
    <section id="templates" className="py-16 sm:py-20 border-t border-border">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mb-8 gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Starter Templates
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pre-configured workflows you can clone and customize immediately.
            </p>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Card 0: Blank Workflow */}
          <button
            onClick={() => onSelectTemplate('Blank Workflow')}
            disabled={loading}
            className="group flex flex-col justify-between rounded-xl border-2 border-dashed border-border p-5 text-left transition-colors hover:border-foreground/40 hover:bg-muted/30 focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <div>
              <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground group-hover:text-foreground group-hover:border-foreground/30 transition-colors">
                <Plus className="size-4" />
              </div>
              <h3 className="mt-4 font-semibold text-sm text-foreground">
                Blank Workflow
              </h3>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Start with an empty canvas and configure your own nodes.
              </p>
            </div>

            <div className="mt-6 flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              <span>{loading ? 'Creating...' : 'Create blank'}</span>
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>

          {/* Cards 1-4: Templates */}
          {TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            return (
              <button
                key={tpl.id}
                onClick={() => onSelectTemplate(tpl.name)}
                disabled={loading}
                className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-border/80 hover:shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground">
                      <Icon className="size-4" />
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {tpl.category}
                    </span>
                  </div>

                  <h3 className="font-semibold text-sm text-foreground group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                    {tpl.name}
                  </h3>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {tpl.description}
                  </p>
                </div>

                <div className="mt-6 pt-3 border-t border-border/60 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {tpl.connectors.map((c) => (
                      <span key={c} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        {c}
                      </span>
                    ))}
                  </div>
                  <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            );
          })}

        </div>

      </div>
    </section>
  );
};

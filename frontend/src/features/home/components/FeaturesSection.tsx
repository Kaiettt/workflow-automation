import React from 'react';
import { 
  Network, 
  Layers, 
  Terminal, 
  History 
} from 'lucide-react';

const CAPABILITIES = [
  {
    title: 'Visual Graph Canvas',
    tag: 'React Flow 12',
    description:
      'Interactive node editor supporting custom input/output schemas, edge connections, real-time node validation, and auto-layout.',
    icon: Network,
    details: ['Port-level type validation', 'Custom node configuration panels', 'Sub-graph edge routing'],
  },
  {
    title: 'Built-in Connectors',
    tag: 'Plugin Framework',
    description:
      'Native connectors for PostgreSQL, Redis, HTTP Webhook receivers, and Gmail. Secure credential storage with test connection verification.',
    icon: Layers,
    details: ['Secure credential isolation', 'HTTP & Webhook ingestion', 'PostgreSQL & Redis actions'],
  },
  {
    title: 'CQRS Execution Engine',
    tag: 'NestJS CQRS',
    description:
      'Decoupled command and query architecture. Executes steps asynchronously with per-node execution telemetry, error isolation, and retry policies.',
    icon: Terminal,
    details: ['Asynchronous event dispatch', 'Per-node execution telemetry', 'Configurable retry & timeouts'],
  },
  {
    title: 'Drafts & Immutable Versions',
    tag: 'Concurrency Safe',
    description:
      'Drafts autosave continuously with advisory lock support. Published versions are immutable snapshots to prevent unexpected production breaks.',
    icon: History,
    details: ['Advisory draft locks', 'Immutable version history', 'Zero-downtime version promotion'],
  },
];

export const FeaturesSection: React.FC = () => {
  return (
    <section id="features" className="py-16 sm:py-20 border-t border-border bg-muted/20">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="mb-12 max-w-2xl">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            Architecture &amp; Core Engine
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            A modular monolith designed for predictable execution, observability, and clean extension seams.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CAPABILITIES.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-border/80"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted/60 text-foreground">
                    <Icon className="size-4" />
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground border border-border px-2 py-0.5 rounded">
                    {item.tag}
                  </span>
                </div>

                <h3 className="text-base font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {item.description}
                </p>

                <div className="mt-5 pt-4 border-t border-border/50 flex flex-wrap gap-2">
                  {item.details.map((detail) => (
                    <span
                      key={detail}
                      className="rounded bg-muted/70 px-2 py-0.5 text-[11px] font-mono text-muted-foreground"
                    >
                      {detail}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

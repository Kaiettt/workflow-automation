import { ArrowRight, Workflow } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from '../templates/catalog';

interface TemplateGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: WorkflowTemplate) => void;
  busy?: boolean;
}

export function TemplateGalleryDialog({
  open,
  onOpenChange,
  onSelect,
  busy = false,
}: TemplateGalleryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(88vh,850px)] w-[min(94vw,1120px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="shrink-0 border-b bg-muted/30 px-6 py-5 pr-12">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Workflow className="size-4" />
            </span>
            <Badge variant="secondary">{WORKFLOW_TEMPLATES.length} starter workflows</Badge>
          </div>
          <DialogTitle className="text-xl">Start with a template</DialogTitle>
          <DialogDescription className="max-w-2xl text-sm">
            Choose a workflow, then connect your accounts and adjust its settings before publishing.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 auto-rows-max gap-4 overflow-y-auto p-5 sm:grid-cols-2 sm:p-6">
          {WORKFLOW_TEMPLATES.map((template, index) => (
            <TemplateCard
              key={template.id}
              template={template}
              index={index}
              busy={busy}
              onSelect={onSelect}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface TemplateCardProps {
  template: WorkflowTemplate;
  index: number;
  busy: boolean;
  onSelect: (template: WorkflowTemplate) => void;
}

function TemplateCard({ template, index, busy, onSelect }: TemplateCardProps) {
  return (
    <Card className="group min-w-0 overflow-hidden border-border/80 p-0 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div className="grid min-h-[300px] grid-rows-[auto_1fr_auto]">
        <div className="flex min-h-36 flex-col justify-between bg-gradient-to-br from-muted/80 via-muted/40 to-background p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg border bg-background/80 text-xs font-semibold text-muted-foreground shadow-xs">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="flex flex-wrap justify-end gap-1.5">
              {template.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="bg-background/70 text-[10px] font-medium">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-5" aria-label="Workflow steps">
            {template.nodes.map((node, nodeIndex) => (
              <div key={node.id} className="flex min-w-0 items-center gap-1.5">
                <span className="max-w-40 truncate rounded-md border bg-background/90 px-2 py-1 text-[10px] font-medium text-foreground shadow-xs">
                  {String(node.data.name)}
                </span>
                {nodeIndex < template.nodes.length - 1 && (
                  <ArrowRight className="size-3 shrink-0 text-muted-foreground/70" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 pb-2">
          <h3 className="font-semibold tracking-tight">{template.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {template.description}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
          <span className="text-xs text-muted-foreground">
            {template.nodes.length} nodes · {template.edges.length} connections
          </span>
          <Button disabled={busy} onClick={() => onSelect(template)} size="sm" className="gap-2">
            {busy ? 'Adding…' : 'Use template'}
            {!busy && <ArrowRight className="size-3.5" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}

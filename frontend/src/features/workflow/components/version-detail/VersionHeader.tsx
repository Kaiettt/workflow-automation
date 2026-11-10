import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VersionHeaderProps {
  workflowId: string;
  versionNumber?: number | string;
}

export const VersionHeader: React.FC<VersionHeaderProps> = ({
  workflowId,
  versionNumber,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2 text-xs truncate">
          <Link
            to="/workflows"
            className="text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            Workflows
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <Link
            to={`/workflows/${workflowId}/versions`}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            <span>Phiên bản</span>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="font-semibold text-foreground">
            v{versionNumber ?? '...'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link to={`/workflows/${workflowId}`}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8">
              <ExternalLink className="size-3.5" />
              <span className="hidden sm:inline">Mở Designer</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};


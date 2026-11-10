import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Layers } from 'lucide-react';

interface RawNodeItem {
  id: string;
  type?: string;
  data?: {
    name?: string;
    key?: string;
    config?: Record<string, unknown>;
  };
}

interface VersionStructureCardProps {
  nodes?: RawNodeItem[];
  edgesCount?: number;
}

export const VersionStructureCard: React.FC<VersionStructureCardProps> = ({
  nodes = [],
  edgesCount = 0,
}) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <span>
                Cấu trúc quy trình trong phiên bản ({nodes.length} nodes, {edgesCount} edges)
              </span>
            </CardTitle>
            <CardDescription>
              Tóm tắt các bước tuần tự được đóng băng trong phiên bản này.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {nodes.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            Phiên bản này không có node nào.
          </div>
        ) : (
          <div className="space-y-3">
            {nodes.map((node, i) => (
              <div
                key={node.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-border bg-muted/20 gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-xs font-bold">
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-semibold text-sm">
                      {node.data?.name || node.id}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                      {node.data?.key || node.type || 'standard-node'}
                    </div>
                  </div>
                </div>

                {node.data?.config && Object.keys(node.data.config).length > 0 && (
                  <div className="text-[11px] font-mono bg-muted/60 px-2.5 py-1 rounded text-muted-foreground max-w-md truncate">
                    {JSON.stringify(node.data.config)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};


import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import type { NodeLogRecord } from '../../types/execution.types';
import { countItems } from '../../utils/node-config';
import { NodeLogDetailAccordion } from './NodeLogDetailAccordion';

interface ExecutionNodeLogTableProps {
  nodeLogs?: NodeLogRecord[];
}

export const ExecutionNodeLogTable: React.FC<ExecutionNodeLogTableProps> = ({
  nodeLogs = [],
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const toggleExpandNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Node execution logs</CardTitle>
            <CardDescription>
              Review the input, output, and errors for each node in this execution.
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {nodeLogs.length} nodes executed
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Node</TableHead>
              <TableHead>Node type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodeLogs.length > 0 ? (
              nodeLogs.map((log, index) => {
                const isExpanded = !!expandedNodes[log.nodeId];
                const isNodeSuccess = log.status === 'SUCCESS';
                const isNodeSkipped = log.status === 'SKIPPED';

                return (
                  <React.Fragment key={log.id || log.nodeId}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleExpandNode(log.nodeId)}
                      data-testid={`node-log-row-${log.nodeId}`}
                    >
                      <TableCell className="text-center p-2">
                        {isExpanded ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )}
                      </TableCell>

                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-2">
                          <span className="flex size-5 items-center justify-center rounded-full bg-muted font-mono text-[10px] text-muted-foreground">
                            {index + 1}
                          </span>
                          <span>{log.nodeId}</span>
                        </div>
                        {countItems(log.input) !== null && (
                          <div className="mt-0.5 ml-7 text-[11px] font-normal text-muted-foreground">
                            {countItems(log.input)} in
                            {countItems(log.output) !== null &&
                              ` → ${countItems(log.output)} out`}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.nodeKey}
                      </TableCell>

                      <TableCell>
                        {isNodeSuccess ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1 text-[11px]"
                          >
                            <CheckCircle2 className="size-3" />
                            <span>SUCCESS ({log.durationMs ?? 0}ms)</span>
                          </Badge>
                        ) : isNodeSkipped ? (
                          <Badge
                            variant="outline"
                            className="gap-1 text-[11px] text-muted-foreground"
                          >
                            <span>SKIPPED</span>
                          </Badge>
                        ) : (
                          <Badge
                            variant="destructive"
                            className="gap-1 text-[11px]"
                          >
                            <XCircle className="size-3" />
                            <span>FAILED</span>
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {log.startedAt
                          ? new Date(log.startedAt).toLocaleTimeString('en-US')
                          : '—'}
                      </TableCell>
                    </TableRow>

                    {/* Expanded Log Detail */}
                    {isExpanded && (
                      <TableRow className="bg-muted/10">
                        <TableCell colSpan={5} className="p-0">
                          <NodeLogDetailAccordion
                            errorMessage={log.errorMessage}
                            input={log.input}
                            output={log.output}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground text-xs">
                  No node logs were recorded.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};


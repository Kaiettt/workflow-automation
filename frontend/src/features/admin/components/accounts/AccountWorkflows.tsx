import { Workflow } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageControls } from '@/features/admin/components/PageControls';
import { QueryFeedback } from '@/features/admin/components/QueryFeedback';
import { useAccountWorkflows } from '@/features/admin/hooks/useAdmin';
import { formatDateTime } from '@/features/admin/utils/format';

interface AccountWorkflowsProps {
  accountId: string;
  page: number;
  onPageChange: (page: number) => void;
}

export function AccountWorkflows({ accountId, page, onPageChange }: AccountWorkflowsProps) {
  const workflows = useAccountWorkflows(accountId, page);
  return (
    <Card className="overflow-hidden shadow-none">
      <CardHeader className="flex-row items-start justify-between space-y-0 p-5">
        <div className="space-y-1.5"><CardTitle className="text-sm">Owned workflows</CardTitle><CardDescription className="text-xs">Workflow status and activity for this account</CardDescription></div>
        {workflows.data && <Badge variant="outline" className="font-normal">{workflows.data.total.toLocaleString('en-US')} {workflows.data.total === 1 ? 'workflow' : 'workflows'}</Badge>}
      </CardHeader>
      {(workflows.isPending || workflows.isError) && <CardContent className="p-5 pt-0"><QueryFeedback pending={workflows.isPending} error={workflows.isError} loadingText="Loading workflows…" errorText="Could not load workflows." onRetry={() => void workflows.refetch()} /></CardContent>}
      {workflows.data && (
        <>
          <Table>
            <TableHeader className="bg-muted/30"><TableRow className="hover:bg-transparent"><TableHead className="px-3 text-xs sm:px-5">Workflow</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Trigger</TableHead><TableHead className="hidden px-5 text-right text-xs md:table-cell">Updated</TableHead></TableRow></TableHeader>
            <TableBody>
              {workflows.data.items.map((workflow) => <TableRow key={workflow.id} className="hover:bg-muted/30">
                <TableCell className="px-3 py-4 sm:px-5"><p className="max-w-[calc(100vw-15rem)] truncate text-sm font-medium sm:max-w-none" title={workflow.name}>{workflow.name}</p><p className="mt-1 max-w-[calc(100vw-15rem)] truncate font-mono text-[11px] text-muted-foreground sm:max-w-none" title={workflow.id}>{workflow.id}</p></TableCell>
                <TableCell><Badge variant="outline" className="font-normal">{workflow.status === 'DRAFT' ? 'Draft' : workflow.status === 'PUBLISHED' ? 'Published' : workflow.status === 'ARCHIVED' ? 'Archived' : workflow.status}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{workflow.active ? 'Enabled' : 'Disabled'}</TableCell>
                <TableCell className="hidden px-5 text-right text-xs text-muted-foreground md:table-cell">{formatDateTime(workflow.updatedAt)}</TableCell>
              </TableRow>)}
            </TableBody>
          </Table>
          {!workflows.data.items.length && <CardContent className="py-12 text-center"><Workflow className="mx-auto mb-3 size-8 text-muted-foreground/50" /><p className="text-sm font-medium">No workflows yet</p><p className="mt-2 text-xs text-muted-foreground">This account does not own any workflows.</p></CardContent>}
          <PageControls page={page} total={workflows.data.total} pageSize={20} onChange={onPageChange} />
        </>
      )}
    </Card>
  );
}

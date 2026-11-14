import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useWorkflowVersions, useDraftStatus } from '../hooks/useWorkflowVersions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  ChevronLeft,
  GitBranch,
  Play,
  Clock,
  ArrowRight,
  History,
  PenTool,
} from 'lucide-react';

export const VersionListPage: React.FC = () => {
  const { workflowId = '' } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();

  const { data: versions, isLoading, isError, refetch } = useWorkflowVersions(workflowId);
  const { data: draftStatus } = useDraftStatus(workflowId);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 text-xs">
            <Link
              to="/workflows"
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              <ChevronLeft className="size-4" />
              <span>Workflows</span>
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-mono text-muted-foreground truncate max-w-[120px] sm:max-w-[200px]">
              {workflowId}
            </span>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-semibold text-foreground">Version</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/workflows/${workflowId}`)}
              className="gap-1.5 text-xs"
            >
              <PenTool className="size-3.5" />
              <span>Open designer</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 container mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground font-mono mb-2">
              <History className="size-3 text-primary" />
              <span>Version Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Published versions
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a version to review its structure and run an execution.
            </p>
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={() => navigate(`/workflows/${workflowId}`)}
            className="w-fit gap-1.5 text-xs shadow-sm"
          >
            <PenTool className="size-3.5" />
            <span>Edit draft in designer</span>
          </Button>
        </div>

        {/* Content Area */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-3 text-sm text-muted-foreground">Loading versions…</p>
          </div>
        )}

        {isError && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive text-base">Could not load versions</CardTitle>
              <CardDescription>
                The workflow could not be found, or the connection failed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && (!versions || versions.length === 0) && (
          <Card className="border-dashed py-12 text-center">
            <CardContent className="flex flex-col items-center justify-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <GitBranch className="size-6" />
              </div>
              <div className="max-w-md">
                <h3 className="text-base font-semibold">No published versions yet</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  This workflow is a draft. Open the designer and select Publish to create version v1.
                </p>
              </div>
              <Button
                onClick={() => navigate(`/workflows/${workflowId}`)}
                size="sm"
                className="mt-2 text-xs gap-1.5"
              >
                <span>Open designer to publish</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && versions && versions.length > 0 && (
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[180px]">Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Published</TableHead>
                  <TableHead className="hidden md:table-cell">Version ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((ver) => {
                  const isActive = draftStatus?.currentPublishedVersion?.id === ver.id;
                  return (
                    <TableRow key={ver.id} className="transition-colors hover:bg-muted/30">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary font-mono text-xs font-bold">
                            v{ver.versionNumber}
                          </div>
                          <span className="font-semibold text-sm">
                            Version {ver.versionNumber}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        {isActive ? (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-medium text-xs">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground text-xs">
                            Archived
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3.5" />
                          <span>
                            {new Date(ver.publishedAt).toLocaleString('en-US')}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="hidden md:table-cell text-xs font-mono text-muted-foreground">
                        <span className="truncate max-w-[220px] inline-block">{ver.id}</span>
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500"
                          onClick={() => navigate(`/workflows/${workflowId}/versions/${ver.id}`)}
                        >
                          <Play className="size-3 fill-current" />
                          <span>View and run</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
};

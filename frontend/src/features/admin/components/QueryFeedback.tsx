import { CircleAlert, LoaderCircle } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface QueryFeedbackProps {
  pending: boolean;
  error: boolean;
  loadingText: string;
  errorText: string;
  onRetry: () => void;
}

export function QueryFeedback({ pending, error, loadingText, errorText, onRetry }: QueryFeedbackProps) {
  if (pending) return <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />{loadingText}</div>;
  if (error) return <Alert variant="destructive"><CircleAlert className="size-4" /><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{errorText}</span><Button variant="outline" size="sm" onClick={onRetry}>Try again</Button></AlertDescription></Alert>;
  return null;
}

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNodeOptions } from '../../hooks/useWorkflowTriggers';
import { FieldShell } from './FieldShell';

interface LoadOptionsFieldProps {
  id: string;
  label: string;
  nodeKey: string;
  property: string;
  // The node's credential: options are read with it (e.g. its Pages).
  credentialId: string | undefined;
  needsCredential: boolean;
  value: string;
  hint?: string;
  onChange: (value: string) => void;
}

// A select whose choices come from the server (x-loadOptions).
export function LoadOptionsField({
  id,
  label,
  nodeKey,
  property,
  credentialId,
  needsCredential,
  value,
  hint,
  onChange,
}: LoadOptionsFieldProps) {
  const { data: options = [], isFetching, error, refetch } = useNodeOptions(
    nodeKey,
    property,
    credentialId,
    needsCredential,
  );
  const waitingForCredential = needsCredential && !credentialId;
  // A value from an older list (e.g. another credential) still shows its id.
  const items = options.some((o) => o.value === value) || !value
    ? options
    : [...options, { value, label: value }];

  const placeholder = waitingForCredential
    ? 'Choose a credential first'
    : isFetching
      ? 'Loading…'
      : options.length === 0
        ? 'Nothing to choose'
        : `Select ${label.toLowerCase()}`;

  return (
    <FieldShell
      id={id}
      label={label}
      hint={error ? <span className="text-destructive">{error.message}</span> : hint}
    >
      <div className="flex gap-2">
        <Select
          value={value || null}
          onValueChange={(next) => next !== null && onChange(next)}
          disabled={waitingForCredential}
          items={items}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {items.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Reload ${label.toLowerCase()}`}
          disabled={waitingForCredential || isFetching}
          onClick={() => void refetch()}
        >
          <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
        </Button>
      </div>
    </FieldShell>
  );
}

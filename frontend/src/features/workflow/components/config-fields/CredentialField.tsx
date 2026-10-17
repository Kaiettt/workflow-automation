import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCredentials } from '../../hooks/useCredentials';
import { AddApiKeyDialog } from '../AddApiKeyDialog';
import { FieldShell } from './FieldShell';

interface CredentialPickerProps {
  id: string;
  label: string;
  // Provider chosen in another field of the node; undefined until it is picked.
  connectorKey: string | undefined;
  value: string;
  onChange: (credentialId: string) => void;
}

// Lists only the credentials of the chosen connector and lets the user save a new API key.
export function CredentialPicker({
  id,
  label,
  connectorKey,
  value,
  onChange,
}: CredentialPickerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: credentials = [], isLoading, isError } = useCredentials(connectorKey);

  // A selection that no longer exists (e.g. another provider's) shows as empty.
  const selected = credentials.some((c) => c.id === value) ? value : null;

  const placeholder = isLoading
    ? 'Loading...'
    : isError
      ? 'Could not load saved keys'
      : credentials.length === 0
        ? 'No saved keys yet'
        : 'Select a key';

  return (
    <FieldShell
      id={id}
      label={label}
      hint={
        !connectorKey
          ? 'Choose a provider first'
          : isError
            ? 'Saved keys could not be loaded. Check your connection and reopen the node.'
            : undefined
      }
    >
      <Select
        value={selected}
        onValueChange={(next) => next !== null && onChange(next)}
        disabled={!connectorKey}
        items={credentials.map((c) => ({ value: c.id, label: c.name }))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue
            placeholder={placeholder}
          />
        </SelectTrigger>
        <SelectContent>
          {credentials.map((credential) => (
            <SelectItem key={credential.id} value={credential.id}>
              {credential.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {connectorKey && (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setDialogOpen(true)}
          >
            + Add API key
          </Button>
          <AddApiKeyDialog
            connectorKey={connectorKey}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onSaved={onChange}
          />
        </>
      )}
    </FieldShell>
  );
}

interface OAuthFieldProps {
  id: string;
  label: string;
  connectorName: string;
  connected: boolean;
  onConnect: () => void;
}

// Credentials of OAuth connectors (Google) come from a pop-up sign-in, not a form.
export function OAuthField({ id, label, connectorName, connected, onConnect }: OAuthFieldProps) {
  return (
    <FieldShell id={id} label={label}>
      <Button type="button" variant="outline" className="w-full" onClick={onConnect}>
        Connect {connectorName}
      </Button>
      {connected && <p className="text-xs text-green-600">✓ Connected</p>}
    </FieldShell>
  );
}

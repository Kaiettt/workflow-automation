import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConnector, useCredentials } from '../../hooks/useCredentials';
import { useOAuth2Popup } from '../../hooks/useOAuth2Popup';
import { AddCredentialDialog } from '../AddCredentialDialog';
import { ConnectorDisabledBanner } from '../ConnectorDisabledBanner';
import { FieldShell } from './FieldShell';

interface CredentialPickerProps {
  id: string;
  label: string;
  // Fixed by the schema (x-connectorKey) or chosen in another field of the node
  // (x-connectorKeyFrom); undefined until that provider is picked.
  connectorKey: string | undefined;
  value: string;
  onChange: (credentialId: string) => void;
}

// Lists only the credentials of the connector and lets the user save a new one.
export function CredentialPicker({
  id,
  label,
  connectorKey,
  value,
  onChange,
}: CredentialPickerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: credentials = [], isLoading, isError } = useCredentials(connectorKey);
  const { data: connector } = useConnector(connectorKey);
  // OAuth2 credentials can be signed in again (more Pages, fresh token).
  const reconnect = useOAuth2Popup();

  // A selection that no longer exists (e.g. another provider's) shows as empty.
  const selected = credentials.some((c) => c.id === value) ? value : null;

  const placeholder = isLoading
    ? 'Loading...'
    : isError
      ? 'Could not load saved connections'
      : credentials.length === 0
        ? 'Nothing saved yet'
        : 'Select a connection';

  return (
    <FieldShell
      id={id}
      label={label}
      hint={
        !connectorKey
          ? 'Choose a provider first'
          : isError
            ? 'Saved connections could not be loaded. Check your network and reopen the node.'
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
          {connector?.allowNewCredentials === false && (
            <ConnectorDisabledBanner connectorName={connector.name} />
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={connector?.allowNewCredentials === false}
            onClick={() => setDialogOpen(true)}
          >
            + Add connection
          </Button>
          {connector?.oauth2 && selected && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                disabled={reconnect.pending}
                onClick={() => void reconnect.connect(selected)}
              >
                {reconnect.pending ? 'Waiting for sign-in...' : 'Reconnect'}
              </Button>
              {reconnect.error && <p className="text-xs text-destructive">{reconnect.error}</p>}
            </>
          )}
          <AddCredentialDialog
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

export interface OAuthFieldProps {
  id: string;
  label: string;
  connectorKey?: string;
  connectorName: string;
  connected: boolean;
  onConnect: () => void;
  error?: string | null;
}

// Credentials of OAuth connectors (Google) come from a pop-up sign-in, not a form.
export function OAuthField({
  id,
  label,
  connectorKey,
  connectorName,
  connected,
  onConnect,
  error,
}: OAuthFieldProps) {
  const { data: connector } = useConnector(connectorKey ?? connectorName);
  const isDisabled = connector?.allowNewCredentials === false;

  return (
    <FieldShell id={id} label={label}>
      {isDisabled && (
        <ConnectorDisabledBanner connectorName={connector?.name ?? connectorName} />
      )}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={isDisabled}
        onClick={onConnect}
      >
        Connect {connector?.name ?? connectorName}
      </Button>
      {connected && <p className="text-xs text-green-600">✓ Connected</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </FieldShell>
  );
}

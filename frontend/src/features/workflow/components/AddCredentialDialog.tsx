import { useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConnector, useSaveCredential } from '../hooks/useCredentials';
import { useOAuth2Popup } from '../hooks/useOAuth2Popup';
import { credentialService } from '../services/credential.service';

interface AddCredentialDialogProps {
  connectorKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (credentialId: string) => void;
}

// The form fields come from the connector's configSchema: one API key for LLM
// vendors, App ID + App Secret for an OAuth2 app (followed by a sign-in pop-up).
export function AddCredentialDialog({
  connectorKey,
  open,
  onOpenChange,
  onSaved,
}: AddCredentialDialogProps) {
  const { data: connector } = useConnector(connectorKey);
  const fields = credentialService.formFields(connector);
  const redirectUrl = connector?.oauth2?.redirectUrl ?? null;
  const [name, setName] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  // OAuth2: the credential is saved first, then connected in the pop-up.
  const [savedId, setSavedId] = useState<string | null>(null);
  const save = useSaveCredential();

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setName('');
        setValues({});
        setSavedId(null);
        save.reset();
      }
      onOpenChange(next);
    },
    [onOpenChange, save],
  );

  const handleConnected = useCallback(
    (credentialId: string) => {
      onSaved(credentialId);
      handleOpenChange(false);
    },
    [onSaved, handleOpenChange],
  );
  const oauth2 = useOAuth2Popup(handleConnected);

  const canSave =
    name.trim() !== '' &&
    fields.every((field) => (values[field.key] ?? '').trim() !== '') &&
    !save.isPending &&
    !oauth2.pending;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    if (redirectUrl && savedId) {
      void oauth2.connect(savedId);
      return;
    }
    save.mutate(
      { connectorKey, name, values },
      {
        onSuccess: (saved) => {
          if (redirectUrl) {
            setSavedId(saved.id);
            void oauth2.connect(saved.id);
          } else {
            onSaved(saved.id);
            handleOpenChange(false);
          }
        },
      },
    );
  };

  const submitLabel = save.isPending
    ? 'Saving...'
    : oauth2.pending
      ? 'Waiting for sign-in...'
      : redirectUrl
        ? savedId
          ? 'Connect again'
          : 'Save & connect'
        : 'Save';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Connect {connector?.name ?? connectorKey}</DialogTitle>
            <DialogDescription>
              {redirectUrl
                ? 'Use the App ID and App Secret of your own app, then sign in to grant access. Secrets are stored encrypted.'
                : 'Secrets are stored encrypted and are never shown again.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="credential-name">Name</Label>
            <Input
              id="credential-name"
              value={name}
              placeholder="e.g. My shop"
              disabled={!!savedId}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`credential-${field.key}`}>{field.title}</Label>
              <Input
                id={`credential-${field.key}`}
                type={field.secret ? 'password' : 'text'}
                autoComplete="off"
                value={values[field.key] ?? ''}
                disabled={!!savedId}
                onChange={(e) =>
                  setValues((current) => ({ ...current, [field.key]: e.target.value }))
                }
              />
              {field.description && (
                <p className="text-[11px] text-muted-foreground">{field.description}</p>
              )}
            </div>
          ))}
          {redirectUrl && <RedirectUrlField url={redirectUrl} />}

          {save.isError && (
            <p className="text-xs text-destructive">
              Could not save. Check the values and try again.
            </p>
          )}
          {oauth2.error && <p className="text-xs text-destructive">{oauth2.error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// The address the provider sends the user back to after sign-in; it must be
// registered in the user's app (e.g. Facebook Login → Valid OAuth Redirect URIs).
function RedirectUrlField({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };
  return (
    <div className="space-y-1.5">
      <Label htmlFor="credential-redirect-url">OAuth Redirect URL</Label>
      <div className="flex gap-2">
        <Input
          id="credential-redirect-url"
          readOnly
          value={url}
          className="font-mono text-xs"
          onFocus={(e) => e.target.select()}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={copy}
          aria-label="Copy OAuth Redirect URL"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Add this URL to the valid OAuth redirect URIs of your app before connecting.
      </p>
    </div>
  );
}

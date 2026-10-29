import { useState } from 'react';
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
import { credentialService } from '../services/credential.service';

interface AddCredentialDialogProps {
  connectorKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (credentialId: string) => void;
}

// The form fields come from the connector's configSchema: one API key for LLM
// vendors, Page ID + Page Access Token for Messenger.
export function AddCredentialDialog({
  connectorKey,
  open,
  onOpenChange,
  onSaved,
}: AddCredentialDialogProps) {
  const { data: connector } = useConnector(connectorKey);
  const fields = credentialService.formFields(connector);
  const [name, setName] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const save = useSaveCredential();

  const canSave =
    name.trim() !== '' &&
    fields.every((field) => (values[field.key] ?? '').trim() !== '') &&
    !save.isPending;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setName('');
      setValues({});
      save.reset();
    }
    onOpenChange(next);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    save.mutate(
      { connectorKey, name, values },
      {
        onSuccess: (saved) => {
          onSaved(saved.id);
          handleOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Connect {connector?.name ?? connectorKey}</DialogTitle>
            <DialogDescription>
              Secrets are stored encrypted and are never shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="credential-name">Name</Label>
            <Input
              id="credential-name"
              value={name}
              placeholder="e.g. My shop"
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
                onChange={(e) =>
                  setValues((current) => ({ ...current, [field.key]: e.target.value }))
                }
              />
            </div>
          ))}

          {save.isError && (
            <p className="text-xs text-destructive">
              Could not save. Check the values and try again.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave}>
              {save.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

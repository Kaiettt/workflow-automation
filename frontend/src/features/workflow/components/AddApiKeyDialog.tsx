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
import { useSaveApiKeyCredential } from '../hooks/useCredentials';

interface AddApiKeyDialogProps {
  connectorKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (credentialId: string) => void;
}

export function AddApiKeyDialog({
  connectorKey,
  open,
  onOpenChange,
  onSaved,
}: AddApiKeyDialogProps) {
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const save = useSaveApiKeyCredential();

  const canSave = name.trim() !== '' && apiKey.trim() !== '' && !save.isPending;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setName('');
      setApiKey('');
      save.reset();
    }
    onOpenChange(next);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    save.mutate(
      { connectorKey, name, apiKey },
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
            <DialogTitle>Add API key for {connectorKey}</DialogTitle>
            <DialogDescription>
              The key is stored encrypted and is never shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="api-key-name">Name</Label>
            <Input
              id="api-key-name"
              value={name}
              placeholder="e.g. Personal key"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="api-key-value">API key</Label>
            <Input
              id="api-key-value"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          {save.isError && (
            <p className="text-xs text-destructive">
              Could not save the key. Check the values and try again.
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

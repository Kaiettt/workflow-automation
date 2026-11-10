import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { WorkflowSummary } from '../../types/workflow.types';

interface DeleteWorkflowDialogProps {
  workflow: WorkflowSummary | null;
  open: boolean;
  isDeleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const DeleteWorkflowDialog: React.FC<DeleteWorkflowDialogProps> = ({
  workflow,
  open,
  isDeleting,
  onConfirm,
  onClose,
}) => {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isDeleting) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete workflow?</DialogTitle>
          <DialogDescription>
            This permanently deletes “{workflow?.name}”, including its published versions and execution history. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={isDeleting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={isDeleting}
            onClick={onConfirm}
          >
            {isDeleting ? 'Deleting…' : 'Delete workflow'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


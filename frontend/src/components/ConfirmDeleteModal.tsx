import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

interface ConfirmDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onConfirm: () => void | Promise<void>;
  pending?: boolean;
}

export function ConfirmDeleteModal({
  open,
  onOpenChange,
  title,
  onConfirm,
  pending = false
}: ConfirmDeleteModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const canConfirm = useMemo(() => confirmText === 'DELETE' && !pending, [confirmText, pending]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(32rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl focus:outline-none">
          <Dialog.Title className="text-lg font-semibold">Delete entry</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-slate-300">
            This action permanently deletes <span className="font-medium">{title}</span>. Type{' '}
            <span className="font-semibold">DELETE</span> to confirm.
          </Dialog.Description>

          <input
            type="text"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            className="mt-4 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            autoFocus
            aria-label="Type DELETE to confirm"
          />

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-slate-500"
                disabled={pending}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={() => {
                if (canConfirm) {
                  void onConfirm();
                }
              }}
              disabled={!canConfirm}
              className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-rose-900"
            >
              {pending ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

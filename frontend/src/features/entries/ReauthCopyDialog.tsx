import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';

interface ReauthCopyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (masterPassword: string) => Promise<boolean>;
}

export function ReauthCopyDialog({ open, onOpenChange, onConfirm }: ReauthCopyDialogProps) {
  const [masterPassword, setMasterPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [errorText, setErrorText] = useState('');

  const handleConfirm = async (): Promise<void> => {
    if (!masterPassword) {
      return;
    }

    setPending(true);
    setErrorText('');

    const ok = await onConfirm(masterPassword);

    if (!ok) {
      setErrorText('Re-authentication failed');
      setPending(false);
      return;
    }

    setMasterPassword('');
    setPending(false);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl focus:outline-none">
          <Dialog.Title className="text-lg font-semibold">Re-authenticate</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-slate-300">
            Enter your master password to copy this password.
          </Dialog.Description>

          <input
            type="password"
            value={masterPassword}
            onChange={(event) => setMasterPassword(event.target.value)}
            className="mt-4 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            aria-label="Master password"
            autoFocus
          />

          {errorText ? <p className="mt-2 text-sm text-rose-300">{errorText}</p> : null}

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
                void handleConfirm();
              }}
              className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              disabled={pending || !masterPassword}
            >
              {pending ? 'Checking...' : 'Confirm'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

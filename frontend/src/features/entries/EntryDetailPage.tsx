import { ArrowLeft, Edit3, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal';
import { PasswordField } from '../../components/PasswordField';
import { copyToClipboard } from '../../services/clipboardService';
import { useUIStore } from '../../store/uiStore';
import { useVaultStore } from '../../store/vaultStore';
import { ReauthCopyDialog } from './ReauthCopyDialog';

export function EntryDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const entry = useVaultStore((state) => state.getEntryById(id));
  const deleteEntry = useVaultStore((state) => state.deleteEntry);
  const verifyForCopy = useVaultStore((state) => state.verifyForCopy);
  const settings = useVaultStore((state) => state.settings);

  const addToast = useUIStore((state) => state.addToast);
  const startClipboardCountdown = useUIStore((state) => state.startClipboardCountdown);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);

  const copiedPassword = useMemo(() => entry?.password ?? '', [entry]);

  if (!entry) {
    return (
      <section className="space-y-3">
        <p className="text-sm text-slate-300">Entry not found.</p>
        <Link to="/app/entries" className="text-sm text-sky-300 hover:underline">
          Back to entries
        </Link>
      </section>
    );
  }

  const performCopy = async (): Promise<void> => {
    const ok = await copyToClipboard(copiedPassword);
    if (!ok) {
      addToast('Copy failed.', 'error');
      return;
    }

    startClipboardCountdown(settings.clipboardClearSeconds);
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/app/entries" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-slate-100">
            <ArrowLeft size={15} />
            Back
          </Link>
          <h2 className="text-xl font-semibold">{entry.title}</h2>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/app/entries/${entry.id}/edit`}
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-slate-500"
          >
            <Edit3 size={14} />
            Edit
          </Link>

          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-rose-700 px-3 py-2 text-sm text-rose-200 hover:border-rose-500"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Username</p>
          <p className="mt-1 text-sm">{entry.username}</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">URL</p>
          <p className="mt-1 text-sm">
            {entry.url ? (
              <a href={entry.url} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">
                {entry.url}
              </a>
            ) : (
              'N/A'
            )}
          </p>
        </div>

        <div className="md:col-span-2">
          <PasswordField
            value={entry.password}
            onCopy={async () => {
              if (settings.requireReauthForCopy) {
                setReauthOpen(true);
                return;
              }

              await performCopy();
            }}
          />
        </div>

        <div className="md:col-span-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Tags</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {entry.tags.length === 0 ? <span className="text-sm text-slate-400">No tags</span> : null}
            {entry.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{entry.notes || 'No notes'}</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Favorite</p>
          <p className="mt-1 text-sm">{entry.favorite ? 'Yes' : 'No'}</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Updated</p>
          <p className="mt-1 text-sm">{new Date(entry.updatedAt).toLocaleString()}</p>
        </div>
      </div>

      <ConfirmDeleteModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={entry.title}
        pending={deletePending}
        onConfirm={async () => {
          setDeletePending(true);
          const deleted = await deleteEntry(entry.id);
          setDeletePending(false);

          if (!deleted) {
            addToast('Delete failed.', 'error');
            return;
          }

          addToast('Entry deleted.', 'success');
          navigate('/app/entries', { replace: true });
        }}
      />

      <ReauthCopyDialog
        open={reauthOpen}
        onOpenChange={setReauthOpen}
        onConfirm={async (masterPassword) => {
          const verified = await verifyForCopy(masterPassword);
          if (!verified) {
            return false;
          }

          await performCopy();
          return true;
        }}
      />
    </section>
  );
}

import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useUIStore } from '../../store/uiStore';
import { useVaultStore } from '../../store/vaultStore';
import type { EntryInput } from '../../types/models';
import { EntryForm } from './EntryForm';

interface EntryEditorPageProps {
  mode: 'create' | 'edit';
}

export function EntryEditorPage({ mode }: EntryEditorPageProps) {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const getEntryById = useVaultStore((state) => state.getEntryById);
  const createEntry = useVaultStore((state) => state.createEntry);
  const updateEntry = useVaultStore((state) => state.updateEntry);

  const addToast = useUIStore((state) => state.addToast);

  const existingEntry = useMemo(() => (mode === 'edit' ? getEntryById(id) : null), [mode, getEntryById, id]);

  if (mode === 'edit' && !existingEntry) {
    return (
      <section className="space-y-2">
        <p className="text-sm text-slate-300">Entry not found.</p>
        <Link to="/app/entries" className="text-sm text-sky-300 hover:underline">
          Back to entries
        </Link>
      </section>
    );
  }

  const handleSubmitEntry = async (payload: EntryInput): Promise<void> => {
    if (mode === 'create') {
      const created = await createEntry(payload);
      if (!created) {
        addToast('Save failed.', 'error');
        return;
      }

      addToast('Entry created.', 'success');
      navigate(`/app/entries/${created.id}`, { replace: true });
      return;
    }

    const updated = await updateEntry(id, payload);
    if (!updated) {
      addToast('Save failed.', 'error');
      return;
    }

    addToast('Entry updated.', 'success');
    navigate(`/app/entries/${id}`, { replace: true });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{mode === 'create' ? 'Add entry' : 'Edit entry'}</h2>
        <Link to="/app/entries" className="text-sm text-slate-300 hover:text-slate-100">
          Cancel
        </Link>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
        <EntryForm
          submitLabel={mode === 'create' ? 'Create entry' : 'Save changes'}
          initialValues={existingEntry ?? undefined}
          onSubmitEntry={handleSubmitEntry}
        />
      </div>
    </section>
  );
}

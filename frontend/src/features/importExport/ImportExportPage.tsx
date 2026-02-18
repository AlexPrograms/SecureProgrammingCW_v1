import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useUIStore } from '../../store/uiStore';
import { useVaultStore } from '../../store/vaultStore';
import { type ImportFormValues, importFormSchema } from '../../types/schemas';

export function ImportExportPage() {
  const exportBackup = useVaultStore((state) => state.exportBackup);
  const previewImport = useVaultStore((state) => state.previewImport);
  const applyImport = useVaultStore((state) => state.applyImport);

  const addToast = useUIStore((state) => state.addToast);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ total: number; added: number; updated: number; skipped: number } | null>(
    null
  );

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting }
  } = useForm<ImportFormValues>({
    resolver: zodResolver(importFormSchema),
    defaultValues: {
      password: ''
    }
  });

  const handleExport = async (): Promise<void> => {
    const password = getValues('password')?.trim() || undefined;
    const backup = await exportBackup(password);

    if (!backup) {
      addToast('Export failed.', 'error');
      return;
    }

    const blob = new Blob([backup], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `vault-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    addToast('Encrypted backup downloaded.', 'success');
  };

  const onPreview = async (): Promise<void> => {
    if (!importFile) {
      addToast('Select a .json file first.', 'error');
      return;
    }

    if (!importFile.name.toLowerCase().endsWith('.json')) {
      addToast('Only .json files are allowed.', 'error');
      return;
    }

    const password = getValues('password')?.trim() || undefined;
    const summary = await previewImport(importFile, password);

    if (!summary) {
      addToast('Import preview failed.', 'error');
      setPreview(null);
      return;
    }

    setPreview(summary);
  };

  const onApply = async (): Promise<void> => {
    if (!importFile) {
      return;
    }

    const password = getValues('password')?.trim() || undefined;
    const summary = await applyImport(importFile, password);

    if (!summary) {
      addToast('Import failed.', 'error');
      return;
    }

    addToast('Import applied.', 'success');
    setPreview(summary);
  };

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
        <h2 className="text-lg font-semibold">Export</h2>
        <p className="mt-2 text-sm text-amber-200">
          Exports are encrypted placeholders only. Plaintext export is disabled.
        </p>

        <form
          className="mt-4 space-y-3"
          onSubmit={handleSubmit(async () => {
            await handleExport();
          })}
        >
          <div>
            <label className="mb-1 block text-sm font-medium">Optional export password</label>
            <input
              type="password"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              {...register('password')}
            />
            {errors.password ? <p className="mt-1 text-xs text-rose-300">{errors.password.message}</p> : null}
          </div>

          <button
            type="submit"
            className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            disabled={isSubmitting}
          >
            Export encrypted backup
          </button>
        </form>
      </article>

      <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
        <h2 className="text-lg font-semibold">Import</h2>
        <p className="mt-2 text-sm text-slate-300">Only `.json` encrypted backup files are accepted.</p>

        <div className="mt-4 space-y-3">
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setImportFile(file);
              setPreview(null);
            }}
            className="block w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />

          <div>
            <label className="mb-1 block text-sm font-medium">Import password (if required)</label>
            <input
              type="password"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              {...register('password')}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              void onPreview();
            }}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-slate-500"
            disabled={!importFile}
          >
            Dry-run validation
          </button>

          {preview ? (
            <div className="rounded-md border border-slate-700 bg-slate-950/60 p-3 text-sm">
              <p className="font-medium">Dry-run summary</p>
              <ul className="mt-2 space-y-1 text-slate-300">
                <li>Total records: {preview.total}</li>
                <li>Will add: {preview.added}</li>
                <li>Will update: {preview.updated}</li>
                <li>Will skip: {preview.skipped}</li>
              </ul>

              <button
                type="button"
                onClick={() => {
                  void onApply();
                }}
                className="mt-3 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
              >
                Confirm apply import
              </button>
            </div>
          ) : null}
        </div>
      </article>
    </section>
  );
}

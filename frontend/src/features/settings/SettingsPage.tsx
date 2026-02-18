import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { useUIStore } from '../../store/uiStore';
import { useVaultStore } from '../../store/vaultStore';
import { type SettingsFormValues, settingsSchema } from '../../types/schemas';

export function SettingsPage() {
  const settings = useVaultStore((state) => state.settings);
  const updateSettings = useVaultStore((state) => state.updateSettings);
  const addToast = useUIStore((state) => state.addToast);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings
  });

  useEffect(() => {
    reset(settings);
  }, [settings, reset]);

  const onSubmit = async (values: SettingsFormValues): Promise<void> => {
    const ok = await updateSettings(values);
    if (!ok) {
      addToast('Settings update failed.', 'error');
      return;
    }

    addToast('Settings updated.', 'success');
  };

  return (
    <section className="max-w-2xl rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <h2 className="text-lg font-semibold">Settings</h2>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="mb-1 block text-sm font-medium">Auto-lock after (minutes)</label>
          <input
            type="number"
            min={1}
            max={120}
            {...register('autoLockMinutes', { valueAsNumber: true })}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          {errors.autoLockMinutes ? (
            <p className="mt-1 text-xs text-rose-300">{errors.autoLockMinutes.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Clipboard clear after (seconds)</label>
          <input
            type="number"
            min={5}
            max={120}
            {...register('clipboardClearSeconds', { valueAsNumber: true })}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          {errors.clipboardClearSeconds ? (
            <p className="mt-1 text-xs text-rose-300">{errors.clipboardClearSeconds.message}</p>
          ) : null}
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('requireReauthForCopy')} />
          Require re-authentication before password copy
        </label>

        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Save settings
          </button>
        </div>
      </form>
    </section>
  );
}

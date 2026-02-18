import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { GeneratorModal } from '../../components/GeneratorModal';
import { PasswordField } from '../../components/PasswordField';
import { copyToClipboard } from '../../services/clipboardService';
import { useUIStore } from '../../store/uiStore';
import { useVaultStore } from '../../store/vaultStore';
import type { EntryInput } from '../../types/models';
import { entrySchema } from '../../types/schemas';

const entryFormSchema = z.object({
  title: z.string().min(1).max(128),
  url: z.string().max(2048).optional().or(z.literal('')),
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(256),
  notes: z.string().max(2000).optional().or(z.literal('')),
  tagsText: z.string().optional().or(z.literal('')),
  favorite: z.boolean()
});

type EntryFormSchemaValues = z.infer<typeof entryFormSchema>;

interface EntryFormProps {
  initialValues?: Partial<EntryInput>;
  submitLabel: string;
  onSubmitEntry: (payload: EntryInput) => Promise<void>;
}

const parseTags = (input: string): string[] =>
  input
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

export function EntryForm({ initialValues, submitLabel, onSubmitEntry }: EntryFormProps) {
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const addToast = useUIStore((state) => state.addToast);
  const startClipboardCountdown = useUIStore((state) => state.startClipboardCountdown);
  const clipboardSeconds = useVaultStore((state) => state.settings.clipboardClearSeconds);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<EntryFormSchemaValues>({
    resolver: zodResolver(entryFormSchema),
    defaultValues: {
      title: initialValues?.title ?? '',
      url: initialValues?.url ?? '',
      username: initialValues?.username ?? '',
      password: initialValues?.password ?? '',
      notes: initialValues?.notes ?? '',
      tagsText: initialValues?.tags?.join(', ') ?? '',
      favorite: initialValues?.favorite ?? false
    }
  });

  const errorCount = useMemo(() => Object.keys(errors).length, [errors]);

  const handleCopyPassword = async (password: string): Promise<void> => {
    const ok = await copyToClipboard(password);
    if (!ok) {
      addToast('Copy failed.', 'error');
      return;
    }

    startClipboardCountdown(clipboardSeconds);
  };

  const onSubmit = async (values: EntryFormSchemaValues): Promise<void> => {
    const payload: EntryInput = {
      title: values.title,
      url: values.url || undefined,
      username: values.username,
      password: values.password,
      notes: values.notes || undefined,
      tags: parseTags(values.tagsText ?? ''),
      favorite: values.favorite
    };

    const parsed = entrySchema.safeParse(payload);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const path = issue.path[0];
        if (path === 'tags') {
          setError('tagsText', { message: issue.message });
          return;
        }

        if (path === 'url') {
          setError('url', { message: issue.message });
          return;
        }

        if (path === 'notes') {
          setError('notes', { message: issue.message });
          return;
        }

        if (path === 'password') {
          setError('password', { message: issue.message });
          return;
        }

        if (path === 'username') {
          setError('username', { message: issue.message });
          return;
        }

        if (path === 'title') {
          setError('title', { message: issue.message });
        }
      });

      return;
    }

    await onSubmitEntry(parsed.data);
  };

  return (
    <>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {errorCount > 0 ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-900/20 px-3 py-2 text-sm text-rose-200">
            Please fix {errorCount} validation issue{errorCount > 1 ? 's' : ''}.
          </p>
        ) : null}

        <div>
          <label className="mb-1 block text-sm font-medium">Title</label>
          <input
            type="text"
            {...register('title')}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
          {errors.title ? <p className="mt-1 text-xs text-rose-300">{errors.title.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">URL (optional)</label>
          <input
            type="url"
            placeholder="https://example.com"
            {...register('url')}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
          {errors.url ? <p className="mt-1 text-xs text-rose-300">{errors.url.message}</p> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Username</label>
            <input
              type="text"
              {...register('username')}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            />
            {errors.username ? <p className="mt-1 text-xs text-rose-300">{errors.username.message}</p> : null}
          </div>

          <div>
            <input type="hidden" {...register('password')} />
            <PasswordField
              value={watch('password')}
              onChange={(next) => setValue('password', next, { shouldValidate: true, shouldDirty: true })}
              onCopy={handleCopyPassword}
            />
            {errors.password ? <p className="mt-1 text-xs text-rose-300">{errors.password.message}</p> : null}
            <button
              type="button"
              onClick={() => setIsGeneratorOpen(true)}
              className="mt-2 rounded-md border border-slate-700 px-3 py-2 text-xs hover:border-slate-500"
            >
              Generate password
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
          <textarea
            rows={4}
            {...register('notes')}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
          {errors.notes ? <p className="mt-1 text-xs text-rose-300">{errors.notes.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Tags (comma-separated, max 10)</label>
          <input
            type="text"
            {...register('tagsText')}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
          {errors.tagsText ? <p className="mt-1 text-xs text-rose-300">{errors.tagsText.message}</p> : null}
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('favorite')} />
          Mark as favorite
        </label>

        <div className="pt-2">
          <button
            type="submit"
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : submitLabel}
          </button>
        </div>
      </form>

      <GeneratorModal
        open={isGeneratorOpen}
        onOpenChange={setIsGeneratorOpen}
        onUse={(password) => {
          setValue('password', password, { shouldValidate: true, shouldDirty: true });
        }}
        onCopy={handleCopyPassword}
      />
    </>
  );
}

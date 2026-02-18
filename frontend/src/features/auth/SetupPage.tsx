import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { AuthCardLayout } from './AuthCardLayout';
import { useUIStore } from '../../store/uiStore';
import { useVaultStore } from '../../store/vaultStore';
import { type SetupFormValues, setupSchema } from '../../types/schemas';

const getStrengthHint = (password: string): string => {
  let score = 0;

  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return 'Strength: weak';
  if (score <= 4) return 'Strength: moderate';
  return 'Strength: strong';
};

export function SetupPage() {
  const navigate = useNavigate();
  const initVault = useVaultStore((state) => state.initVault);
  const addToast = useUIStore((state) => state.addToast);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      masterPassword: '',
      confirmMasterPassword: '',
      hint: ''
    }
  });

  const masterPasswordValue = watch('masterPassword') ?? '';
  const strengthHint = useMemo(() => getStrengthHint(masterPasswordValue), [masterPasswordValue]);

  const onSubmit = async (values: SetupFormValues): Promise<void> => {
    const ok = await initVault(values.masterPassword, values.hint || undefined);

    if (!ok) {
      addToast('Setup failed.', 'error');
      return;
    }

    addToast('Vault created. Unlock to continue.', 'success');
    navigate('/unlock', { replace: true });
  };

  return (
    <AuthCardLayout
      title="Welcome"
      subtitle="Create your vault. Master password is kept in memory only in this mock UI."
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="mb-1 block text-sm font-medium">Master password</label>
          <input
            type="password"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            autoComplete="new-password"
            {...register('masterPassword')}
          />
          <p className="mt-1 text-xs text-slate-400">{strengthHint}</p>
          {errors.masterPassword ? <p className="mt-1 text-xs text-rose-300">{errors.masterPassword.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Confirm master password</label>
          <input
            type="password"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            autoComplete="new-password"
            {...register('confirmMasterPassword')}
          />
          {errors.confirmMasterPassword ? (
            <p className="mt-1 text-xs text-rose-300">{errors.confirmMasterPassword.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Hint (optional)</label>
          <input
            type="text"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            maxLength={64}
            {...register('hint')}
          />
          {errors.hint ? <p className="mt-1 text-xs text-rose-300">{errors.hint.message}</p> : null}
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create vault'}
        </button>
      </form>
    </AuthCardLayout>
  );
}

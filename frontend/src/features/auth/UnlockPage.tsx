import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { AuthCardLayout } from './AuthCardLayout';
import { useUIStore } from '../../store/uiStore';
import { useVaultStore } from '../../store/vaultStore';
import { type UnlockFormValues, unlockSchema } from '../../types/schemas';

export function UnlockPage() {
  const navigate = useNavigate();
  const unlockVault = useVaultStore((state) => state.unlockVault);
  const failedUnlockAttempts = useVaultStore((state) => state.failedUnlockAttempts);
  const vaultHint = useVaultStore((state) => state.vaultHint);
  const getUnlockDelaySeconds = useVaultStore((state) => state.getUnlockDelaySeconds);
  const lastLockReason = useVaultStore((state) => state.lastLockReason);
  const clearLockReasonNotice = useVaultStore((state) => state.clearLockReasonNotice);
  const addToast = useUIStore((state) => state.addToast);

  const [showPassword, setShowPassword] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(getUnlockDelaySeconds());

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<UnlockFormValues>({
    resolver: zodResolver(unlockSchema),
    defaultValues: {
      masterPassword: ''
    }
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDelaySeconds(getUnlockDelaySeconds());
    }, 300);

    return () => {
      window.clearInterval(timer);
    };
  }, [getUnlockDelaySeconds]);

  const onSubmit = async (values: UnlockFormValues): Promise<void> => {
    setErrorText('');

    if (delaySeconds > 0) {
      return;
    }

    const ok = await unlockVault(values.masterPassword);

    if (!ok) {
      const remaining = getUnlockDelaySeconds();
      setDelaySeconds(remaining);
      setErrorText('Unlock failed');
      if (remaining <= 0) {
        addToast('Unlock failed.', 'error');
      }
      return;
    }

    navigate('/app/entries', { replace: true });
  };

  return (
    <AuthCardLayout title="Unlock" subtitle="Enter your master password to unlock this local vault.">
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {lastLockReason === 'INACTIVITY' ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-900/30 px-3 py-2 text-sm text-amber-200">
            Locked due to inactivity.
            <button
              type="button"
              onClick={clearLockReasonNotice}
              className="ml-2 rounded border border-amber-400/40 px-2 py-1 text-xs"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {vaultHint ? (
          <p className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300">Hint: {vaultHint}</p>
        ) : null}

        <div>
          <label className="mb-1 block text-sm font-medium">Master password</label>
          <div className="flex items-center gap-2">
            <input
              type={showPassword ? 'text' : 'password'}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              autoComplete="current-password"
              {...register('masterPassword')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="rounded-md border border-slate-700 p-2 hover:border-slate-500"
              aria-label={showPassword ? 'Hide master password' : 'Show master password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {errors.masterPassword ? <p className="mt-1 text-xs text-rose-300">{errors.masterPassword.message}</p> : null}
        </div>

        {errorText ? <p className="text-sm text-rose-300">{errorText}</p> : null}
        {failedUnlockAttempts > 0 ? (
          <p className="text-xs text-slate-400">Failed attempts: {failedUnlockAttempts}</p>
        ) : null}
        {delaySeconds > 0 ? <p className="text-sm text-amber-300">Try again in {delaySeconds}s</p> : null}

        <button
          type="submit"
          className="w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          disabled={isSubmitting || delaySeconds > 0}
        >
          Unlock
        </button>
      </form>
    </AuthCardLayout>
  );
}

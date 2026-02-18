import { useMemo } from 'react';

import { useUIStore } from '../store/uiStore';

const toneStyles = {
  info: 'border-slate-600 bg-slate-800 text-slate-100',
  success: 'border-emerald-500/40 bg-emerald-900/40 text-emerald-100',
  error: 'border-rose-500/40 bg-rose-900/40 text-rose-100'
};

export function ToastStack() {
  const toasts = useUIStore((state) => state.toasts);
  const clipboard = useUIStore((state) => state.clipboard);
  const removeToast = useUIStore((state) => state.removeToast);

  const allToasts = useMemo(() => {
    const list = [...toasts];

    if (clipboard.active) {
      list.unshift({
        id: 'clipboard-countdown',
        message: `Copied. Clears in ${clipboard.remainingSeconds}s.`,
        tone: 'info' as const,
        expiresAt: null
      });
    }

    return list;
  }, [clipboard.active, clipboard.remainingSeconds, toasts]);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 flex-col gap-2" aria-live="polite">
      {allToasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-md border px-3 py-2 text-sm shadow-lg ${toneStyles[toast.tone]}`}
        >
          <p>{toast.message}</p>
          {toast.id === 'clipboard-countdown' ? (
            <p className="mt-1 text-xs text-slate-300">Clipboard clearing is best-effort.</p>
          ) : null}
          {toast.id !== 'clipboard-countdown' ? (
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="mt-2 rounded bg-black/20 px-2 py-1 text-xs hover:bg-black/40"
            >
              Dismiss
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

import { useEffect } from 'react';

import { clearClipboardBestEffort } from '../services/clipboardService';
import { useUIStore } from '../store/uiStore';

export function ClipboardManager() {
  const clipboard = useUIStore((state) => state.clipboard);
  const tickClipboardCountdown = useUIStore((state) => state.tickClipboardCountdown);
  const clearExpiredToasts = useUIStore((state) => state.clearExpiredToasts);
  const addToast = useUIStore((state) => state.addToast);
  const markClipboardCleared = useUIStore((state) => state.markClipboardCleared);

  useEffect(() => {
    const toastTimer = window.setInterval(() => {
      clearExpiredToasts();
    }, 1000);

    return () => {
      window.clearInterval(toastTimer);
    };
  }, [clearExpiredToasts]);

  useEffect(() => {
    if (!clipboard.active) {
      return;
    }

    const timer = window.setInterval(() => {
      tickClipboardCountdown();
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [clipboard.active, tickClipboardCountdown]);

  useEffect(() => {
    if (!clipboard.clearRequestedAt) {
      return;
    }

    const run = async (): Promise<void> => {
      await clearClipboardBestEffort();
      addToast('Clipboard clear attempted (best-effort).', 'info', 5000);
      markClipboardCleared();
    };

    void run();
  }, [clipboard.clearRequestedAt, addToast, markClipboardCleared]);

  return null;
}

import { useEffect } from 'react';

import { useVaultStore } from '../store/vaultStore';

const activityEvents: Array<keyof WindowEventMap> = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart'
];

export const useIdleLock = (): void => {
  const vaultStatus = useVaultStore((state) => state.vaultStatus);
  const autoLockMinutes = useVaultStore((state) => state.settings.autoLockMinutes);
  const lockNow = useVaultStore((state) => state.lockNow);

  useEffect(() => {
    if (vaultStatus !== 'UNLOCKED') {
      return;
    }

    let timeoutId: number | undefined;
    const timeoutMs = autoLockMinutes * 60 * 1000;

    const resetTimer = (): void => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        lockNow('INACTIVITY');
      }, timeoutMs);
    };

    const onActivity = (): void => {
      resetTimer();
    };

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true });
    });

    resetTimer();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity);
      });
    };
  }, [vaultStatus, autoLockMinutes, lockNow]);
};

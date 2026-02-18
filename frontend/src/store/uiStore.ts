import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
  expiresAt: number | null;
}

interface ClipboardState {
  active: boolean;
  remainingSeconds: number;
  clearRequestedAt: number | null;
}

interface UIState {
  toasts: Toast[];
  clipboard: ClipboardState;
  addToast: (message: string, tone?: Toast['tone'], durationMs?: number) => void;
  removeToast: (id: string) => void;
  clearExpiredToasts: () => void;
  startClipboardCountdown: (seconds: number) => void;
  tickClipboardCountdown: () => void;
  markClipboardCleared: () => void;
}

const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],
  clipboard: {
    active: false,
    remainingSeconds: 0,
    clearRequestedAt: null
  },
  addToast: (message, tone = 'info', durationMs = 4000) => {
    set((state) => ({
      toasts: [
        {
          id: createId(),
          message,
          tone,
          expiresAt: durationMs > 0 ? Date.now() + durationMs : null
        },
        ...state.toasts
      ]
    }));
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    }));
  },
  clearExpiredToasts: () => {
    const now = Date.now();
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.expiresAt === null || toast.expiresAt > now)
    }));
  },
  startClipboardCountdown: (seconds) => {
    const normalized = Math.max(1, Math.floor(seconds));
    set({
      clipboard: {
        active: true,
        remainingSeconds: normalized,
        clearRequestedAt: null
      }
    });
  },
  tickClipboardCountdown: () => {
    const clipboard = get().clipboard;
    if (!clipboard.active) {
      return;
    }

    if (clipboard.remainingSeconds <= 1) {
      set({
        clipboard: {
          active: false,
          remainingSeconds: 0,
          clearRequestedAt: Date.now()
        }
      });
      return;
    }

    set({
      clipboard: {
        ...clipboard,
        remainingSeconds: clipboard.remainingSeconds - 1
      }
    });
  },
  markClipboardCleared: () => {
    set((state) => ({
      clipboard: {
        ...state.clipboard,
        clearRequestedAt: null
      }
    }));
  }
}));

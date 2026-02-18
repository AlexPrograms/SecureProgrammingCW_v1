import { create } from 'zustand';

import {
  createEntry,
  deleteEntry,
  exportEncryptedBackup,
  getSettings,
  getVaultHint,
  getVaultStatus,
  importEncryptedBackup,
  initVault,
  listAudit,
  listEntries,
  lock,
  previewImportEncryptedBackup,
  unlock,
  updateEntry,
  updateSettings as persistSettings,
  verifyMasterPassword
} from '../services/apiVaultService';
import type { AuditEvent, Entry, EntryInput, ImportPreview, Settings, VaultStatus } from '../types/models';

export type LockReason = 'MANUAL' | 'INACTIVITY' | null;

const DEFAULT_SETTINGS: Settings = {
  autoLockMinutes: 5,
  clipboardClearSeconds: 15,
  requireReauthForCopy: true
};

interface VaultState {
  vaultStatus: VaultStatus;
  vaultHint: string | null;
  entries: Entry[];
  settings: Settings;
  audit: AuditEvent[];
  failedUnlockAttempts: number;
  unlockBlockedUntil: number | null;
  lastLockReason: LockReason;
  isHydrating: boolean;
  hydrateFromServer: () => Promise<void>;
  initVault: (masterPassword: string, hint?: string) => Promise<boolean>;
  unlockVault: (masterPassword: string) => Promise<boolean>;
  lockNow: (reason?: Exclude<LockReason, null>) => Promise<void>;
  clearLockReasonNotice: () => void;
  refreshEntries: () => Promise<void>;
  refreshAudit: () => Promise<void>;
  createEntry: (payload: EntryInput) => Promise<Entry | null>;
  updateEntry: (id: string, payload: EntryInput) => Promise<Entry | null>;
  deleteEntry: (id: string) => Promise<boolean>;
  getEntryById: (id: string) => Entry | null;
  verifyForCopy: (masterPassword: string) => Promise<boolean>;
  exportBackup: (password?: string) => Promise<string | null>;
  previewImport: (file: File, password?: string) => Promise<ImportPreview | null>;
  applyImport: (file: File, password?: string) => Promise<ImportPreview | null>;
  updateSettings: (next: Settings) => Promise<boolean>;
  getUnlockDelaySeconds: () => number;
}

const getDelayForAttempt = (attempt: number): number => {
  const raw = Math.pow(2, attempt);
  return Math.min(30, raw);
};

export const useVaultStore = create<VaultState>((set, get) => ({
  vaultStatus: 'LOCKED',
  vaultHint: null,
  entries: [],
  settings: DEFAULT_SETTINGS,
  audit: [],
  failedUnlockAttempts: 0,
  unlockBlockedUntil: null,
  lastLockReason: null,
  isHydrating: true,
  hydrateFromServer: async () => {
    set({ isHydrating: true });

    try {
      const status = await getVaultStatus();

      if (status === 'UNLOCKED') {
        const [entries, audit, settings, vaultHint] = await Promise.all([
          listEntries(),
          listAudit(),
          getSettings(),
          getVaultHint()
        ]);

        set({
          vaultStatus: status,
          entries,
          audit,
          settings,
          vaultHint,
          failedUnlockAttempts: 0,
          unlockBlockedUntil: null
        });
      } else {
        const vaultHint = await getVaultHint();
        set({
          vaultStatus: status,
          entries: [],
          audit: [],
          settings: DEFAULT_SETTINGS,
          vaultHint,
          failedUnlockAttempts: 0,
          unlockBlockedUntil: null
        });
      }
    } catch {
      set({
        vaultStatus: 'LOCKED',
        entries: [],
        audit: [],
        settings: DEFAULT_SETTINGS,
        vaultHint: null
      });
    } finally {
      set({ isHydrating: false });
    }
  },
  initVault: async (masterPassword, hint) => {
    try {
      const ok = await initVault(masterPassword, hint);
      if (!ok) {
        return false;
      }

      const vaultHint = await getVaultHint();
      set({
        vaultStatus: 'LOCKED',
        vaultHint,
        entries: [],
        audit: []
      });
      return true;
    } catch {
      return false;
    }
  },
  unlockVault: async (masterPassword) => {
    const blockedSeconds = get().getUnlockDelaySeconds();
    if (blockedSeconds > 0) {
      return false;
    }

    try {
      const ok = await unlock(masterPassword);
      if (!ok) {
        const failedUnlockAttempts = get().failedUnlockAttempts + 1;
        const delaySeconds = getDelayForAttempt(failedUnlockAttempts);
        const status = await getVaultStatus();

        set({
          failedUnlockAttempts,
          unlockBlockedUntil: Date.now() + delaySeconds * 1000,
          vaultStatus: status
        });
        return false;
      }

      const [entries, audit, settings, status] = await Promise.all([
        listEntries(),
        listAudit(),
        getSettings(),
        getVaultStatus()
      ]);

      set({
        vaultStatus: status,
        entries,
        audit,
        settings,
        failedUnlockAttempts: 0,
        unlockBlockedUntil: null,
        lastLockReason: null
      });
      return true;
    } catch {
      return false;
    }
  },
  lockNow: async (reason = 'MANUAL') => {
    try {
      await lock();
    } catch {
      // Keep locked UI even if request fails.
    }

    set({
      vaultStatus: 'LOCKED',
      entries: [],
      audit: [],
      lastLockReason: reason
    });
  },
  clearLockReasonNotice: () => {
    set({ lastLockReason: null });
  },
  refreshEntries: async () => {
    if (get().vaultStatus !== 'UNLOCKED') {
      return;
    }

    try {
      const entries = await listEntries();
      set({ entries });
    } catch {
      // Keep existing cache on transient failures.
    }
  },
  refreshAudit: async () => {
    if (get().vaultStatus !== 'UNLOCKED') {
      return;
    }

    try {
      const audit = await listAudit();
      set({ audit });
    } catch {
      // Keep existing cache on transient failures.
    }
  },
  createEntry: async (payload) => {
    try {
      const result = await createEntry(payload);
      const [entries, audit] = await Promise.all([listEntries(), listAudit()]);
      set({ entries, audit });
      return result;
    } catch {
      return null;
    }
  },
  updateEntry: async (id, payload) => {
    try {
      const result = await updateEntry(id, payload);
      if (!result) {
        return null;
      }

      const [entries, audit] = await Promise.all([listEntries(), listAudit()]);
      set({ entries, audit });
      return result;
    } catch {
      return null;
    }
  },
  deleteEntry: async (id) => {
    try {
      const deleted = await deleteEntry(id);
      const [entries, audit] = await Promise.all([listEntries(), listAudit()]);
      set({ entries, audit });
      return deleted;
    } catch {
      return false;
    }
  },
  getEntryById: (id) => {
    const cached = get().entries.find((entry) => entry.id === id);
    return cached ?? null;
  },
  verifyForCopy: async (masterPassword) => {
    try {
      const verified = await verifyMasterPassword(masterPassword);
      if (verified) {
        const status = await getVaultStatus();
        set({ vaultStatus: status });
      }
      return verified;
    } catch {
      return false;
    }
  },
  exportBackup: async (password) => {
    try {
      return await exportEncryptedBackup(password);
    } catch {
      return null;
    }
  },
  previewImport: async (file, password) => {
    try {
      return await previewImportEncryptedBackup(file, password);
    } catch {
      return null;
    }
  },
  applyImport: async (file, password) => {
    try {
      const summary = await importEncryptedBackup(file, password);
      const [entries, audit, settings] = await Promise.all([listEntries(), listAudit(), getSettings()]);
      set({ entries, audit, settings });
      return summary;
    } catch {
      return null;
    }
  },
  updateSettings: async (next) => {
    try {
      const saved = await persistSettings(next);
      set({ settings: saved });
      return true;
    } catch {
      return false;
    }
  },
  getUnlockDelaySeconds: () => {
    const unlockBlockedUntil = get().unlockBlockedUntil;
    if (!unlockBlockedUntil) {
      return 0;
    }

    const remainingMs = unlockBlockedUntil - Date.now();
    if (remainingMs <= 0) {
      set({ unlockBlockedUntil: null });
      return 0;
    }

    return Math.ceil(remainingMs / 1000);
  }
}));

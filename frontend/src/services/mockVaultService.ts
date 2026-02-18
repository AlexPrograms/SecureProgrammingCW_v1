import { encryptedBackupSchema, entryRecordSchema } from '../types/schemas';
import type {
  AuditEvent,
  EncryptedBackup,
  Entry,
  EntryInput,
  ImportPreview,
  VaultStatus
} from '../types/models';

interface VaultMemoryState {
  initialized: boolean;
  locked: boolean;
  masterPassword: string | null;
  hint: string | null;
  entries: Entry[];
  audit: AuditEvent[];
}

const state: VaultMemoryState = {
  initialized: false,
  locked: true,
  masterPassword: null,
  hint: null,
  entries: [],
  audit: []
};

const nowIso = (): string => new Date().toISOString();

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const sanitizeMeta = (
  meta?: Record<string, string | number | boolean>
): Record<string, string | number | boolean> | undefined => {
  if (!meta) {
    return undefined;
  }

  const blockedKeys = ['password', 'secret', 'master', 'token'];
  const safe: Record<string, string | number | boolean> = {};

  Object.entries(meta).forEach(([key, value]) => {
    const normalized = key.toLowerCase();
    if (blockedKeys.some((blocked) => normalized.includes(blocked))) {
      return;
    }

    safe[key] = value;
  });

  return Object.keys(safe).length ? safe : undefined;
};

const pushAudit = (
  type: string,
  outcome: AuditEvent['outcome'],
  meta?: Record<string, string | number | boolean>
): void => {
  state.audit.unshift({
    id: generateId(),
    ts: nowIso(),
    type,
    outcome,
    meta: sanitizeMeta(meta)
  });
};

const ensureInitialized = (): void => {
  if (!state.initialized) {
    throw new Error('Vault unavailable');
  }
};

const ensureUnlocked = (): void => {
  ensureInitialized();
  if (state.locked) {
    throw new Error('Vault unavailable');
  }
};

const cloneEntry = (entry: Entry): Entry => ({
  ...entry,
  tags: [...entry.tags]
});

const mockEncrypt = (raw: string): string => {
  // TODO: replace this placeholder with authenticated encryption in backend.
  return btoa(unescape(encodeURIComponent(raw)));
};

const mockDecrypt = (cipherText: string): string => {
  // TODO: replace this placeholder with authenticated decryption in backend.
  return decodeURIComponent(escape(atob(cipherText)));
};

const serializeEntry = (entry: Entry, password?: string): string => {
  const wrapper = JSON.stringify({
    version: 1,
    protected: Boolean(password),
    data: entry
  });

  return mockEncrypt(wrapper);
};

const deserializeEntry = (cipherText: string, _password?: string): Entry => {
  const decoded = mockDecrypt(cipherText);
  const parsed = JSON.parse(decoded) as { version: number; protected: boolean; data: Entry };
  return entryRecordSchema.parse(parsed.data);
};

const readBackupInput = async (fileOrText: File | string): Promise<string> => {
  if (typeof fileOrText === 'string') {
    return fileOrText;
  }

  return fileOrText.text();
};

const parseBackup = async (fileOrText: File | string): Promise<EncryptedBackup> => {
  const raw = await readBackupInput(fileOrText);
  const parsedJson = JSON.parse(raw) as unknown;
  return encryptedBackupSchema.parse(parsedJson);
};

export const getVaultStatus = (): VaultStatus => {
  if (!state.initialized) {
    return 'NO_VAULT';
  }

  return state.locked ? 'LOCKED' : 'UNLOCKED';
};

export const getVaultHint = (): string | null => state.hint;

export const initVault = (masterPassword: string, hint?: string): boolean => {
  if (state.initialized) {
    pushAudit('VAULT_INIT', 'FAILURE', { reason: 'already_initialized' });
    return false;
  }

  state.initialized = true;
  state.locked = true;
  state.masterPassword = masterPassword;
  state.hint = hint?.trim() || null;
  state.entries = [];
  pushAudit('VAULT_INIT', 'SUCCESS');
  return true;
};

export const unlock = (masterPassword: string): boolean => {
  ensureInitialized();

  if (state.masterPassword === masterPassword) {
    state.locked = false;
    pushAudit('VAULT_UNLOCK', 'SUCCESS');
    return true;
  }

  pushAudit('VAULT_UNLOCK', 'FAILURE');
  return false;
};

export const verifyMasterPassword = (masterPassword: string): boolean => {
  ensureInitialized();
  const result = state.masterPassword === masterPassword;
  pushAudit('VERIFY_MASTER_PASSWORD', result ? 'SUCCESS' : 'FAILURE');
  return result;
};

export const lock = (): void => {
  if (!state.initialized) {
    return;
  }

  state.locked = true;
  pushAudit('VAULT_LOCK', 'SUCCESS');
};

export const listEntries = (): Entry[] => {
  ensureUnlocked();

  return [...state.entries]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map(cloneEntry);
};

export const getEntry = (id: string): Entry | null => {
  ensureUnlocked();

  const entry = state.entries.find((item) => item.id === id);
  return entry ? cloneEntry(entry) : null;
};

export const createEntry = (payload: EntryInput): Entry => {
  ensureUnlocked();

  const entry: Entry = {
    id: generateId(),
    title: payload.title,
    url: payload.url,
    username: payload.username,
    password: payload.password,
    notes: payload.notes,
    tags: [...payload.tags],
    favorite: payload.favorite,
    updatedAt: nowIso()
  };

  state.entries.unshift(entry);
  pushAudit('ENTRY_CREATE', 'SUCCESS', { entryId: entry.id });
  return cloneEntry(entry);
};

export const updateEntry = (id: string, payload: EntryInput): Entry | null => {
  ensureUnlocked();

  const index = state.entries.findIndex((item) => item.id === id);
  if (index < 0) {
    pushAudit('ENTRY_UPDATE', 'FAILURE', { entryId: id });
    return null;
  }

  const updated: Entry = {
    ...state.entries[index],
    ...payload,
    tags: [...payload.tags],
    updatedAt: nowIso()
  };

  state.entries[index] = updated;
  pushAudit('ENTRY_UPDATE', 'SUCCESS', { entryId: id });
  return cloneEntry(updated);
};

export const deleteEntry = (id: string): boolean => {
  ensureUnlocked();

  const before = state.entries.length;
  state.entries = state.entries.filter((item) => item.id !== id);
  const deleted = state.entries.length !== before;
  pushAudit('ENTRY_DELETE', deleted ? 'SUCCESS' : 'FAILURE', { entryId: id });
  return deleted;
};

export const exportEncryptedBackup = (password?: string): string => {
  ensureUnlocked();

  const backup: EncryptedBackup = {
    format: 'MOCK_ENCRYPTED_BACKUP_V1',
    createdAt: nowIso(),
    exportedWithPassword: Boolean(password),
    entries: state.entries.map((entry) => ({
      id: entry.id,
      updatedAt: entry.updatedAt,
      cipherText: serializeEntry(entry, password)
    }))
  };

  pushAudit('BACKUP_EXPORT', 'SUCCESS', { entryCount: backup.entries.length });
  return JSON.stringify(backup, null, 2);
};

export const previewImportEncryptedBackup = async (
  fileOrText: File | string,
  password?: string
): Promise<ImportPreview> => {
  ensureUnlocked();

  const backup = await parseBackup(fileOrText);
  const incoming = backup.entries.map((item) => deserializeEntry(item.cipherText, password));
  const existing = new Map(state.entries.map((entry) => [entry.id, entry]));

  let added = 0;
  let updated = 0;
  let skipped = 0;

  incoming.forEach((entry) => {
    const current = existing.get(entry.id);
    if (!current) {
      added += 1;
      return;
    }

    if (new Date(entry.updatedAt).getTime() > new Date(current.updatedAt).getTime()) {
      updated += 1;
      return;
    }

    skipped += 1;
  });

  const summary: ImportPreview = {
    total: incoming.length,
    added,
    updated,
    skipped
  };

  pushAudit('BACKUP_IMPORT_PREVIEW', 'SUCCESS', {
    total: summary.total,
    added: summary.added,
    updated: summary.updated,
    skipped: summary.skipped
  });
  return summary;
};

export const importEncryptedBackup = async (
  fileOrText: File | string,
  password?: string
): Promise<ImportPreview> => {
  ensureUnlocked();

  const backup = await parseBackup(fileOrText);
  const incoming = backup.entries.map((item) => deserializeEntry(item.cipherText, password));
  const existing = new Map(state.entries.map((entry) => [entry.id, entry]));

  let added = 0;
  let updated = 0;
  let skipped = 0;

  incoming.forEach((entry) => {
    const current = existing.get(entry.id);
    if (!current) {
      state.entries.push({ ...entry, tags: [...entry.tags] });
      added += 1;
      return;
    }

    if (new Date(entry.updatedAt).getTime() > new Date(current.updatedAt).getTime()) {
      const index = state.entries.findIndex((item) => item.id === entry.id);
      if (index >= 0) {
        state.entries[index] = { ...entry, tags: [...entry.tags] };
      }
      updated += 1;
      return;
    }

    skipped += 1;
  });

  const summary: ImportPreview = {
    total: incoming.length,
    added,
    updated,
    skipped
  };

  pushAudit('BACKUP_IMPORT_APPLY', 'SUCCESS', {
    total: summary.total,
    added: summary.added,
    updated: summary.updated,
    skipped: summary.skipped
  });
  return summary;
};

export const listAudit = (): AuditEvent[] => [...state.audit].map((event) => ({ ...event }));

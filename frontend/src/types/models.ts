export type VaultStatus = 'NO_VAULT' | 'LOCKED' | 'UNLOCKED';

export interface Entry {
  id: string;
  title: string;
  url?: string;
  username: string;
  password: string;
  notes?: string;
  tags: string[];
  favorite: boolean;
  updatedAt: string;
}

export interface EntryInput {
  title: string;
  url?: string;
  username: string;
  password: string;
  notes?: string;
  tags: string[];
  favorite: boolean;
}

export interface Settings {
  autoLockMinutes: number;
  clipboardClearSeconds: number;
  requireReauthForCopy: boolean;
}

export type AuditOutcome = 'SUCCESS' | 'FAILURE';

export interface AuditEvent {
  id: string;
  ts: string;
  type: string;
  outcome: AuditOutcome;
  meta?: Record<string, string | number | boolean>;
}

export interface ImportPreview {
  total: number;
  added: number;
  updated: number;
  skipped: number;
}

export interface EncryptedBackup {
  format: 'MOCK_ENCRYPTED_BACKUP_V1';
  createdAt: string;
  exportedWithPassword: boolean;
  entries: Array<{
    id: string;
    updatedAt: string;
    cipherText: string;
  }>;
}

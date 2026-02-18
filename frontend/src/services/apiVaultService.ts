import { apiRequest, isApiClientError } from './apiClient';
import type { AuditEvent, Entry, EntryInput, ImportPreview, Settings, VaultStatus } from '../types/models';

interface BackupExportResponse {
  version: number;
  createdAt: string;
  kdfParams: {
    memoryCost: number;
    timeCost: number;
    parallelism: number;
  } | null;
  salt: string | null;
  export: {
    nonce: string;
    ciphertext: string;
  };
  note: string;
}

interface BackupImportResponse {
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
}

interface VaultStatusResponse {
  status: VaultStatus;
}

const toImportPreview = (result: BackupImportResponse): ImportPreview => ({
  total: result.added + result.updated + result.skipped,
  added: result.added,
  updated: result.updated,
  skipped: result.skipped
});

const assertNoImportErrors = (result: BackupImportResponse): void => {
  if (result.errors.length > 0) {
    throw new Error('Import failed.');
  }
};

const fetchEntryWithFallback = async (id: string, fallback: Omit<Entry, 'password' | 'notes' | 'tags'>): Promise<Entry> => {
  try {
    return await apiRequest<Entry>(`/entries/${id}`);
  } catch {
    return {
      ...fallback,
      password: '',
      notes: '',
      tags: []
    };
  }
};

export const getVaultStatus = async (): Promise<VaultStatus> => {
  const response = await apiRequest<VaultStatusResponse>('/vault/status');
  return response.status;
};

export const getVaultHint = async (): Promise<string | null> => {
  // Hint is intentionally not exposed by current backend status response.
  return null;
};

export const initVault = async (masterPassword: string, hint?: string): Promise<boolean> => {
  try {
    await apiRequest<{ ok: boolean }>('/vault/setup', {
      method: 'POST',
      body: {
        masterPassword,
        hint: hint?.trim() || undefined
      }
    });
    return true;
  } catch {
    return false;
  }
};

export const unlock = async (masterPassword: string): Promise<boolean> => {
  try {
    await apiRequest<{ ok: boolean }>('/vault/unlock', {
      method: 'POST',
      body: { masterPassword }
    });
    return true;
  } catch {
    return false;
  }
};

export const verifyMasterPassword = async (masterPassword: string): Promise<boolean> => {
  return unlock(masterPassword);
};

export const lock = async (): Promise<void> => {
  await apiRequest<void>('/vault/lock', {
    method: 'POST'
  });
};

export const listEntries = async (): Promise<Entry[]> => {
  const summaries = await apiRequest<Array<Omit<Entry, 'password' | 'notes' | 'tags'>>>('/entries');

  const entries = await Promise.all(
    summaries.map((summary) =>
      fetchEntryWithFallback(summary.id, {
        id: summary.id,
        title: summary.title,
        url: summary.url,
        username: summary.username,
        favorite: summary.favorite,
        updatedAt: summary.updatedAt
      })
    )
  );

  return entries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

export const getEntry = async (id: string): Promise<Entry | null> => {
  try {
    return await apiRequest<Entry>(`/entries/${id}`);
  } catch (error) {
    if (isApiClientError(error) && error.status === 404) {
      return null;
    }

    throw error;
  }
};

export const createEntry = async (payload: EntryInput): Promise<Entry> => {
  return apiRequest<Entry>('/entries', {
    method: 'POST',
    body: payload
  });
};

export const updateEntry = async (id: string, payload: EntryInput): Promise<Entry | null> => {
  try {
    return await apiRequest<Entry>(`/entries/${id}`, {
      method: 'PUT',
      body: payload
    });
  } catch (error) {
    if (isApiClientError(error) && error.status === 404) {
      return null;
    }

    throw error;
  }
};

export const deleteEntry = async (id: string): Promise<boolean> => {
  try {
    await apiRequest<void>(`/entries/${id}`, {
      method: 'DELETE'
    });
    return true;
  } catch (error) {
    if (isApiClientError(error) && error.status === 404) {
      return false;
    }

    throw error;
  }
};

export const exportEncryptedBackup = async (password?: string): Promise<string> => {
  const response = await apiRequest<BackupExportResponse>('/backup/export', {
    method: 'POST',
    body: {
      exportPassword: password || undefined
    }
  });

  return JSON.stringify(response, null, 2);
};

export const previewImportEncryptedBackup = async (file: File, password?: string): Promise<ImportPreview> => {
  const formData = new FormData();
  formData.append('file', file);
  if (password) {
    formData.append('password', password);
  }

  const response = await apiRequest<BackupImportResponse>('/backup/import/preview', {
    method: 'POST',
    body: formData
  });

  assertNoImportErrors(response);
  return toImportPreview(response);
};

export const importEncryptedBackup = async (file: File, password?: string): Promise<ImportPreview> => {
  const formData = new FormData();
  formData.append('file', file);
  if (password) {
    formData.append('password', password);
  }

  const response = await apiRequest<BackupImportResponse>('/backup/import/apply', {
    method: 'POST',
    body: formData
  });

  assertNoImportErrors(response);
  return toImportPreview(response);
};

export const listAudit = async (): Promise<AuditEvent[]> => {
  return apiRequest<AuditEvent[]>('/audit');
};

export const getSettings = async (): Promise<Settings> => {
  return apiRequest<Settings>('/settings');
};

export const updateSettings = async (payload: Settings): Promise<Settings> => {
  return apiRequest<Settings>('/settings', {
    method: 'PUT',
    body: payload
  });
};

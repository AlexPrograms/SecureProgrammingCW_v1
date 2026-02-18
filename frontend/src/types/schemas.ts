import { z } from 'zod';

import type { Settings } from './models';

const isSafeHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const setupSchema = z
  .object({
    masterPassword: z.string().min(12, 'Master password must be at least 12 characters.'),
    confirmMasterPassword: z.string(),
    hint: z.string().max(64, 'Hint must be at most 64 characters.').optional().or(z.literal(''))
  })
  .refine((values) => values.masterPassword === values.confirmMasterPassword, {
    path: ['confirmMasterPassword'],
    message: 'Passwords must match.'
  });

export const unlockSchema = z.object({
  masterPassword: z.string().min(1, 'Master password is required.')
});

export const entrySchema = z.object({
  title: z.string().min(1, 'Title is required.').max(128, 'Title must be at most 128 characters.'),
  url: z
    .string()
    .max(2048, 'URL is too long.')
    .optional()
    .or(z.literal(''))
    .refine((value) => !value || isSafeHttpUrl(value), {
      message: 'URL must be a valid http(s) URL.'
    }),
  username: z.string().min(1, 'Username is required.').max(128, 'Username must be at most 128 characters.'),
  password: z.string().min(1, 'Password is required.').max(256, 'Password must be at most 256 characters.'),
  notes: z.string().max(2000, 'Notes must be at most 2000 characters.').optional().or(z.literal('')),
  tags: z
    .array(z.string().min(1).max(24, 'Each tag must be at most 24 characters.'))
    .max(10, 'At most 10 tags are allowed.'),
  favorite: z.boolean()
});

export const entryRecordSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1).max(128),
    url: z.string().optional(),
    username: z.string().min(1).max(128),
    password: z.string().min(1).max(256),
    notes: z.string().optional(),
    tags: z.array(z.string().min(1).max(24)).max(10),
    favorite: z.boolean(),
    updatedAt: z.string().datetime()
  })
  .strict();

export const settingsSchema = z.object({
  autoLockMinutes: z.number().min(1, 'Must be at least 1 minute.').max(120, 'Must be at most 120 minutes.'),
  clipboardClearSeconds: z.number().min(5, 'Must be at least 5 seconds.').max(120, 'Must be at most 120 seconds.'),
  requireReauthForCopy: z.boolean()
}) satisfies z.ZodType<Settings>;

export const importFormSchema = z.object({
  password: z.string().max(256, 'Password is too long.').optional().or(z.literal(''))
});

export const encryptedBackupSchema = z
  .object({
    format: z.literal('MOCK_ENCRYPTED_BACKUP_V1'),
    createdAt: z.string().datetime(),
    exportedWithPassword: z.boolean(),
    entries: z.array(
      z
        .object({
          id: z.string().min(1),
          updatedAt: z.string().datetime(),
          cipherText: z.string().min(1)
        })
        .strict()
    )
  })
  .strict();

export type SetupFormValues = z.infer<typeof setupSchema>;
export type UnlockFormValues = z.infer<typeof unlockSchema>;
export type EntryFormValues = z.infer<typeof entrySchema>;
export type SettingsFormValues = z.infer<typeof settingsSchema>;
export type ImportFormValues = z.infer<typeof importFormSchema>;

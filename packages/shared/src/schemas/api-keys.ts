import { z } from 'zod';
import { cleanText } from '../sanitize.js';

/** Server-to-server keys a workspace's product uses to call the support API. */
export const API_KEY_SCOPES = ['customers:read', 'tickets:read', 'tickets:write'] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const CreateApiKeyRequestSchema = z.object({
  name: cleanText(1, 60),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1).max(API_KEY_SCOPES.length),
});
export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequestSchema>;

export const ApiKeySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** The first characters, so the key can be told apart; never the whole key. */
  prefix: z.string(),
  scopes: z.array(z.string()),
  lastUsedAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type ApiKey = z.infer<typeof ApiKeySchema>;

/** Returned once, at creation: the only time the plain key is visible. */
export const CreatedApiKeySchema = z.object({ key: ApiKeySchema, plainKey: z.string() });
export type CreatedApiKey = z.infer<typeof CreatedApiKeySchema>;

export const ApiKeyListSchema = z.object({ items: z.array(ApiKeySchema) });

export const AuditEntrySchema = z.object({
  id: z.uuid(),
  actor: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  entityType: z.string(),
  entityId: z.string(),
  action: z.string(),
  createdAt: z.iso.datetime(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;
export const AuditListSchema = z.object({ items: z.array(AuditEntrySchema) });

import { z } from 'zod';
import { cleanText } from '../sanitize.js';

/**
 * Workspaces (tenants): any business signs up, gets a workspace and configures the product
 * from the UI. These are the contracts of the signup and workspace endpoints.
 */
export const WORKSPACE_ROLES = ['OWNER', 'ADMIN', 'AGENT'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** The default workspace (BookLeaf). The old shared `/embed` address leads to its widget. */
export const DEFAULT_WORKSPACE_SLUG = 'bookleaf';

/**
 * Pages of the author app under the old shared address (`/embed/tickets/…`, before F-18 gave
 * every workspace its own `/embed/<slug>`). They redirect to BookLeaf's, so they cannot be slugs.
 */
export const LEGACY_EMBED_SECTIONS = ['ask', 'tickets', 'history'] as const;

/** Reserved words that cannot be used as a workspace slug (they clash with routes or confuse). */
export const RESERVED_SLUGS: readonly string[] = [
  'admin',
  'api',
  'app',
  'auth',
  'embed',
  'login',
  'signup',
  'www',
  ...LEGACY_EMBED_SECTIONS,
];

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const WorkspaceSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(40)
  .regex(SLUG_PATTERN, 'Use lowercase letters, digits and hyphens')
  .refine((s) => !RESERVED_SLUGS.includes(s), 'This name is reserved');

/** A slug that names an existing workspace, e.g. in a widget address (`/embed/<slug>`). */
export const WorkspaceSlugRefSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(40)
  .regex(SLUG_PATTERN, 'not a workspace address');

/** Strong password floor (CLAUDE.md §6): 12–128 characters with letters and digits. */
export const PasswordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Include a letter')
  .regex(/\d/, 'Include a digit');

export const SignupRequestSchema = z.object({
  workspaceName: cleanText(2, 80),
  slug: WorkspaceSlugSchema,
  ownerName: cleanText(1, 80),
  email: z.string().trim().toLowerCase().pipe(z.email().min(5).max(254)),
  password: PasswordSchema,
});
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

export const WorkspaceSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const SignupResponseSchema = z.object({
  workspace: WorkspaceSchema,
  user: z.object({ id: z.uuid(), email: z.string(), name: z.string() }),
});
export type SignupResponse = z.infer<typeof SignupResponseSchema>;

/** The signed-in staff member's workspace, with their role in it. */
export const MyWorkspaceSchema = z.object({
  workspace: WorkspaceSchema,
  role: z.enum(WORKSPACE_ROLES),
});
export type MyWorkspace = z.infer<typeof MyWorkspaceSchema>;

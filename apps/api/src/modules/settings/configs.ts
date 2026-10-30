import type { WorkspaceSettings as Row } from '@prisma/client';
import type { Db } from '../../platform/db.js';
import type { AssistantLimits } from '../assistant/limits.js';
import { DEFAULT_WORKSPACE_ID } from '../workspaces/constants.js';
import { withWorkspace } from '../../platform/tenancy.js';

/** What one workspace's chat, voice and AI run with right now. */
export interface WorkspaceConfig {
  limits: AssistantLimits;
  chatEnabled: boolean;
  voiceEnabled: boolean;
  /** Null: the platform's chat model. */
  chatModel: string | null;
  triageModel: string | null;
  draftModel: string | null;
  toneGuide: string;
  voiceName: string;
  /** What customers see: the brand name (never empty) and its colour (#rrggbb). */
  brand: { name: string; color: string };
}

/** Values a workspace starts with before its owner saves anything (today's env and switches). */
export interface PlatformDefaults {
  limits: AssistantLimits;
  voiceName: string;
  switches: () => Promise<{ chatEnabled: boolean; voiceEnabled: boolean; chatModel: string }>;
}

/** The fields a new workspace row starts with. */
export interface SeedValues {
  chatEnabled: boolean;
  voiceEnabled: boolean;
  chatModel: string;
  messagesPerMinute: number;
  messagesPerDay: number;
  maxTurnsPerSession: number;
  voiceName: string;
  maxCallSeconds: number;
  callsPerHour: number;
  callsPerDay: number;
  brandColor: string;
}

/** A new workspace row starts from the platform values, so nothing changes until someone edits. */
export async function seedValues(p: PlatformDefaults): Promise<SeedValues> {
  const { chat, voice } = p.limits;
  const switches = await p.switches();
  return {
    chatEnabled: switches.chatEnabled,
    voiceEnabled: switches.voiceEnabled,
    chatModel: switches.chatModel,
    messagesPerMinute: chat.messagesPerMinute,
    messagesPerDay: chat.messagesPerDay,
    maxTurnsPerSession: chat.maxTurnsPerSession,
    voiceName: p.voiceName,
    maxCallSeconds: voice.maxCallSeconds,
    callsPerHour: voice.callsPerHour,
    callsPerDay: voice.callsPerDay,
    brandColor: '#d13f53',
  };
}

type ConfigSource = Pick<
  Row,
  | 'chatEnabled'
  | 'voiceEnabled'
  | 'chatModel'
  | 'triageModel'
  | 'draftModel'
  | 'toneGuide'
  | 'voiceName'
  | 'messagesPerMinute'
  | 'messagesPerDay'
  | 'maxTurnsPerSession'
  | 'maxCallSeconds'
  | 'callsPerHour'
  | 'callsPerDay'
  | 'brandName'
  | 'brandColor'
>;

/** Limits come from the row; the platform keeps the hard caps it never hands to a workspace. */
function toConfig(s: ConfigSource, p: PlatformDefaults, fallbackName: string): WorkspaceConfig {
  const { chat, voice, drafts } = p.limits;
  return {
    limits: {
      chat: {
        maxMessageChars: chat.maxMessageChars,
        messagesPerMinute: s.messagesPerMinute,
        messagesPerDay: s.messagesPerDay,
        maxTurnsPerSession: s.maxTurnsPerSession,
        sessionsPerHour: chat.sessionsPerHour,
      },
      voice: {
        maxCallSeconds: Math.min(s.maxCallSeconds, voice.maxCallSeconds),
        callsPerHour: s.callsPerHour,
        callsPerDay: s.callsPerDay,
      },
      drafts,
    },
    chatEnabled: s.chatEnabled,
    voiceEnabled: s.voiceEnabled,
    chatModel: s.chatModel,
    triageModel: s.triageModel,
    draftModel: s.draftModel,
    toneGuide: s.toneGuide,
    voiceName: s.voiceName,
    brand: { name: s.brandName.trim() || fallbackName, color: s.brandColor },
  };
}

/** Without a saved brand name: BookLeaf keeps its short name, other workspaces use theirs. */
const brandFallback = (workspaceId: string, workspaceName: string | undefined) =>
  workspaceId === DEFAULT_WORKSPACE_ID ? 'BookLeaf' : (workspaceName ?? 'Support');

/** Short enough that another server instance sees a change within seconds. */
const CACHE_MS = 5_000;

/**
 * Every workspace's effective settings, read through a short cache that the settings screens
 * clear on save. A workspace without a saved row runs on the platform values.
 */
export function createWorkspaceConfigs(db: Db, platform: PlatformDefaults, now = Date.now) {
  const cache = new Map<string, { at: number; config: Promise<WorkspaceConfig> }>();
  async function load(workspaceId: string): Promise<WorkspaceConfig> {
    // Cached per workspace, so always read as that workspace, whoever asks first (S.8).
    const ws = await withWorkspace(workspaceId, () =>
      db.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true, settings: true },
      }),
    );
    const fallbackName = brandFallback(workspaceId, ws?.name);
    if (ws?.settings) return toConfig(ws.settings, platform, fallbackName);
    const seed = await seedValues(platform);
    const blank = { triageModel: null, draftModel: null, toneGuide: '', brandName: '' };
    return toConfig({ ...seed, ...blank }, platform, fallbackName);
  }
  return {
    forWorkspace(workspaceId: string): Promise<WorkspaceConfig> {
      const hit = cache.get(workspaceId);
      if (hit && now() - hit.at < CACHE_MS) return hit.config;
      const config = load(workspaceId);
      cache.set(workspaceId, { at: now(), config });
      config.catch(() => cache.delete(workspaceId));
      return config;
    },
    invalidate: (workspaceId: string) => void cache.delete(workspaceId),
    seed: () => seedValues(platform),
  };
}

export type WorkspaceConfigs = ReturnType<typeof createWorkspaceConfigs>;

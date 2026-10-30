import type { Plan, WidgetTheme } from '@bookleaf/shared';
import type { WorkspaceSettings as Row } from '@prisma/client';
import type { Db } from '../../platform/db.js';
import type { AssistantLimits } from '../assistant/limits.js';
import type { PlanReader } from '../platform/plans.js';
import { DEFAULT_WORKSPACE_ID } from '../workspaces/constants.js';
import { withWorkspace } from '../../platform/tenancy.js';
import { capLimits } from './plan-caps.js';

/** What one workspace's chat, voice and AI run with right now (its settings within its plan). */
export interface WorkspaceConfig {
  limits: AssistantLimits;
  /** On only when the customer switched it on and its plan allows it. */
  chatEnabled: boolean;
  voiceEnabled: boolean;
  /** False when a super admin switched AI off for this customer. */
  aiEnabled: boolean;
  plan: Plan;
  voiceName: string;
  /** What customers see in the widget and the author screens. */
  brand: {
    name: string;
    color: string;
    logoUrl: string | null;
    launcherText: string;
    theme: WidgetTheme;
  };
}

/** Values a workspace starts with before its owner saves anything (today's env limits). */
export interface PlatformDefaults {
  limits: AssistantLimits;
  voiceName: string;
  plans: PlanReader;
}

/** The fields a new workspace row starts with: channels off, the env's limits. */
export interface SeedValues {
  chatEnabled: boolean;
  voiceEnabled: boolean;
  messagesPerMinute: number;
  messagesPerDay: number;
  maxTurnsPerSession: number;
  voiceName: string;
  maxCallSeconds: number;
  callsPerHour: number;
  callsPerDay: number;
  brandColor: string;
}

export function seedValues(p: Pick<PlatformDefaults, 'limits' | 'voiceName'>): SeedValues {
  const { chat, voice } = p.limits;
  return {
    chatEnabled: false,
    voiceEnabled: false,
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

type ConfigSource = SeedValues &
  Pick<Row, 'brandName' | 'logoUrl' | 'launcherText' | 'widgetTheme'>;

/** Limits come from the row, capped by the plan; the platform keeps its own hard caps too. */
function toConfig(s: ConfigSource, p: PlatformDefaults, plan: Plan, fallbackName: string) {
  return {
    limits: capLimits(s, plan, p.limits),
    chatEnabled: s.chatEnabled && plan.chatAllowed,
    voiceEnabled: s.voiceEnabled && plan.voiceAllowed,
    aiEnabled: plan.aiEnabled,
    plan,
    voiceName: s.voiceName,
    brand: {
      name: s.brandName.trim() || fallbackName,
      color: s.brandColor,
      logoUrl: s.logoUrl,
      launcherText: s.launcherText,
      theme: s.widgetTheme,
    },
  } satisfies WorkspaceConfig;
}

/** Without a saved brand name: BookLeaf keeps its short name, other workspaces use theirs. */
const brandFallback = (workspaceId: string, workspaceName: string | undefined) =>
  workspaceId === DEFAULT_WORKSPACE_ID ? 'BookLeaf' : (workspaceName ?? 'Support');

const BLANK = { brandName: '', logoUrl: null, launcherText: '', widgetTheme: 'AUTO' } as const;

/** Short enough that another server instance sees a change within seconds. */
const CACHE_MS = 5_000;

/**
 * Every workspace's effective settings, read through a short cache that the settings screens
 * (and the console's plan changes) clear on save. A workspace without a saved row runs on the
 * starting values.
 */
export function createWorkspaceConfigs(db: Db, platform: PlatformDefaults, now = Date.now) {
  const cache = new Map<string, { at: number; config: Promise<WorkspaceConfig> }>();
  async function load(workspaceId: string): Promise<WorkspaceConfig> {
    // Cached per workspace, so always read as that workspace, whoever asks first (S.8).
    const [ws, { plan }] = await Promise.all([
      withWorkspace(workspaceId, () =>
        db.workspace.findUnique({
          where: { id: workspaceId },
          select: { name: true, settings: true },
        }),
      ),
      platform.plans.forWorkspace(workspaceId),
    ]);
    const fallbackName = brandFallback(workspaceId, ws?.name);
    const source = ws?.settings ?? { ...seedValues(platform), ...BLANK };
    return toConfig(source, platform, plan, fallbackName);
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
    invalidate: (workspaceId: string) => {
      if (workspaceId) cache.delete(workspaceId);
      else cache.clear();
    },
    seed: () => Promise.resolve(seedValues(platform)),
  };
}

export type WorkspaceConfigs = ReturnType<typeof createWorkspaceConfigs>;

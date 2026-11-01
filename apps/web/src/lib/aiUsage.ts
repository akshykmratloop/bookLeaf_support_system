import { useQuery } from '@tanstack/react-query';
import type { AiUsage, AiUsageFeature, AiUsageUnit } from '@bookleaf/shared';
import { api } from './api';

/** The workspace admin's own report; the console reads any customer's under its own keys. */
export const aiUsageKeys = {
  workspace: ['workspace', 'ai-usage'] as const,
  customer: (id: string) => ['platform', 'customers', id, 'ai-usage'] as const,
};

export const useWorkspaceAiUsage = () =>
  useQuery({ queryKey: aiUsageKeys.workspace, queryFn: () => api<AiUsage>('/workspace/usage') });

export const useCustomerAiUsage = (id: string) =>
  useQuery({
    queryKey: aiUsageKeys.customer(id),
    queryFn: () => api<AiUsage>(`/platform/customers/${encodeURIComponent(id)}/usage`),
  });

const MICROS_PER_DOLLAR = 1_000_000;
const SMALLEST_SHOWN = 0.0001;

/** Micro-dollars as money. AI calls cost fractions of a cent, so under $1 shows up to 4 decimals. */
export function formatUsd(micros: number): string {
  const dollars = micros / MICROS_PER_DOLLAR;
  if (dollars > 0 && dollars < SMALLEST_SHOWN) return `<$${SMALLEST_SHOWN}`;
  const amount = dollars.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: dollars < 1 ? 4 : 2,
  });
  return `$${amount}`;
}

/** "94.9 credits", "1 credit" (1 credit = $0.001). */
export function formatCredits(credits: number): string {
  const n = credits.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `${n} ${credits === 1 ? 'credit' : 'credits'}`;
}

const UNIT_NAMES: Record<AiUsageUnit, [one: string, many: string]> = {
  ticket: ['ticket', 'tickets'],
  draft: ['draft', 'drafts'],
  reply: ['reply', 'replies'],
  minute: ['min', 'min'],
};

/** "2 tickets", "1 reply", "1.5 min". */
export function formatUnits(unit: AiUsageUnit, units: number): string {
  const [one, many] = UNIT_NAMES[unit];
  return `${units.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${units === 1 ? one : many}`;
}

/** What each feature is called on the usage screen. */
export const FEATURE_LABELS: Record<AiUsageFeature, string> = {
  TRIAGE: 'Ticket sorting',
  DRAFT: 'Reply drafts',
  CHAT: 'Author chat',
  VOICE: 'Voice calls',
};

/** The unit's name after "per": "ticket", "reply", "min". */
export const perUnitName = (unit: AiUsageUnit) => UNIT_NAMES[unit][0];

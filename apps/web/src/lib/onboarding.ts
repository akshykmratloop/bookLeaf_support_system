import { useQuery } from '@tanstack/react-query';
import type { OnboardingStatus, OnboardingStep, OnboardingTestTicket } from '@bookleaf/shared';
import { api } from './api';

export const onboardingKeys = { status: ['workspace', 'onboarding'] as const };

/** Re-checked while the page is open, so steps tick as real events arrive. */
const RECHECK_MS = 15_000;

export const useOnboarding = () =>
  useQuery({
    queryKey: onboardingKeys.status,
    queryFn: () => api<OnboardingStatus>('/workspace/onboarding'),
    refetchInterval: RECHECK_MS,
  });

export const sendTestTicket = () =>
  api<OnboardingTestTicket>('/workspace/onboarding/test-ticket', { method: 'POST' });

export interface SetupProgress {
  done: number;
  total: number;
  /** 0 to 100, for the progress bar. */
  percent: number;
  /** Every required step is done (optional ones may be skipped). */
  complete: boolean;
  /** Steps that were set up but now fail. */
  broken: number;
}

export function progressOf(steps: readonly OnboardingStep[]): SetupProgress {
  const done = steps.filter((s) => s.state === 'done').length;
  const total = steps.length;
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    complete: total > 0 && steps.every((s) => s.optional || s.state === 'done'),
    broken: steps.filter((s) => s.state === 'broken').length,
  };
}

/** "5 of 8 done", plus how many need attention. */
export function progressText(p: SetupProgress): string {
  const base = `${p.done} of ${p.total} done`;
  return p.broken > 0 ? `${base} · ${p.broken} need${p.broken === 1 ? 's' : ''} attention` : base;
}

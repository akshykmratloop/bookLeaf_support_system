import type { OnboardingStepState } from '@bookleaf/shared';

/** One step's outcome, before its id and optional flag are added. */
export interface StepResult {
  state: OnboardingStepState;
  /** One plain sentence: what the check found, or why the step is broken. */
  detail: string;
  /** When the check last passed; null when never, or when it has no time. */
  at: Date | null;
}

export const done = (detail: string, at: Date | null = null): StepResult => ({
  state: 'done',
  detail,
  at,
});
export const todo = (detail: string): StepResult => ({ state: 'todo', detail, at: null });
export const broken = (detail: string): StepResult => ({ state: 'broken', detail, at: null });

/** "1 field", "3 fields"; "2 categories" with the plural form given. */
export const plural = (n: number, word: string, many = `${word}s`) =>
  `${n} ${n === 1 ? word : many}`;

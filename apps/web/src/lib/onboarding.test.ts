import type { OnboardingStep, OnboardingStepId } from '@bookleaf/shared';
import { ONBOARDING_STEP_IDS } from '@bookleaf/shared';
import { describe, expect, it } from 'vitest';
import { progressOf, progressText } from './onboarding';
import {
  docsHref,
  signInSample,
  STEP_COPY,
  widgetPreviewUrl,
  widgetSample,
} from './onboardingSteps';

const step = (id: OnboardingStepId, state: OnboardingStep['state']): OnboardingStep => ({
  id,
  state,
  optional: id === 'extras',
  detail: '',
  at: null,
});
const all = (state: OnboardingStep['state']) => ONBOARDING_STEP_IDS.map((id) => step(id, state));

describe('progressOf', () => {
  it('counts done steps out of all eight', () => {
    const steps = all('todo').map((s, i) => (i < 5 ? { ...s, state: 'done' as const } : s));
    const p = progressOf(steps);
    expect(p).toMatchObject({ done: 5, total: 8, percent: 63, complete: false });
    expect(progressText(p)).toBe('5 of 8 done');
  });

  it('is complete when every required step is done, even with the optional one skipped', () => {
    const steps = all('done').map((s) =>
      s.id === 'extras' ? { ...s, state: 'todo' as const } : s,
    );
    expect(progressOf(steps)).toMatchObject({ complete: true, done: 7 });
  });

  it('is not complete while a required step is broken, and says so', () => {
    const steps = all('done').map((s) =>
      s.id === 'widget' ? { ...s, state: 'broken' as const } : s,
    );
    const p = progressOf(steps);
    expect(p.complete).toBe(false);
    expect(progressText(p)).toBe('7 of 8 done · 1 needs attention');
  });

  it('a broken optional step does not block completion', () => {
    const steps = all('done').map((s) =>
      s.id === 'extras' ? { ...s, state: 'broken' as const } : s,
    );
    expect(progressOf(steps).complete).toBe(true);
  });

  it('an empty list is 0% and not complete', () => {
    expect(progressOf([])).toMatchObject({ percent: 0, complete: false });
  });
});

describe('step copy', () => {
  it('has a title, links to admin pages and a docs section for every step', () => {
    for (const id of ONBOARDING_STEP_IDS) {
      const copy = STEP_COPY[id];
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.links.length).toBeGreaterThan(0);
      expect(copy.links.every((l) => l.to.startsWith('/admin'))).toBe(true);
      expect(copy.docs.anchor).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('links every admin page the guide promises', () => {
    const labels = new Set(
      ONBOARDING_STEP_IDS.flatMap((id) => STEP_COPY[id].links.map((l) => l.label)),
    );
    for (const label of [
      'Product connection',
      'Customer data',
      'Widget settings',
      'Categories',
      'Knowledge base',
      'AI behaviour',
      'API keys',
      'Webhooks',
    ])
      expect(labels.has(label)).toBe(true);
  });

  it('builds a docs link only when the server has a docs address', () => {
    const section = STEP_COPY.signIn.docs;
    expect(docsHref(null, section)).toBeNull();
    expect(docsHref('https://docs.example.com/integration#old', section)).toBe(
      'https://docs.example.com/integration#2a-sign-the-customer-in',
    );
  });
});

describe('code samples', () => {
  it('fills the sign-in sample with the workspace slug as the token issuer', () => {
    expect(signInSample('acme')).toContain(".setIssuer('acme')");
    expect(signInSample('acme')).toContain(".setAudience('support')");
  });

  it('fills the widget tag with the support URL and the slug', () => {
    const tag = widgetSample('https://support.example.com', 'acme');
    expect(tag).toContain('src="https://support.example.com/embed.js"');
    expect(tag).toContain('data-workspace="acme"');
    expect(widgetPreviewUrl('https://support.example.com', 'acme')).toBe(
      'https://support.example.com/embed/acme',
    );
  });
});

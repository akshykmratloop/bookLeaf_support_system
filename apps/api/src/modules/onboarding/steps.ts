import type { OnboardingStep, OnboardingStepId } from '@bookleaf/shared';
import { OPTIONAL_ONBOARDING_STEPS } from '@bookleaf/shared';
import type { ConnectionFact, OnboardingFacts } from './facts.js';
import { broken, done, plural, todo, type StepResult } from './step-result.js';
import { extrasStep, originsStep, teachStep, testStep } from './steps-later.js';

const MAX_DETAIL = 500;
const clip = (text: string) =>
  text.length > MAX_DETAIL ? `${text.slice(0, MAX_DETAIL - 3)}...` : text;

function connectStep({ connection: c }: OnboardingFacts): StepResult {
  if (c.kind === 'none') return todo('No product connection yet.');
  if (c.kind === 'env') return done("Connected through this server's own settings.");
  if (!c.lastTest) return todo('Saved, but not tested yet. Press Test on Product connection.');
  if (!c.lastTest.ok) return broken(`The last connection test failed: ${c.lastTest.detail}`);
  return done(`The last connection test passed: ${c.lastTest.detail}`, c.lastTest.at);
}

/** How many customer fields get a value: all of them from a full-shape source. */
const mappedFields = (f: OnboardingFacts) =>
  f.hasContractSource ? f.fields.total : f.fields.mapped;

function fieldsStep(f: OnboardingFacts): StepResult {
  if (f.connection.kind === 'none') return todo('Connect your data first.');
  const n = mappedFields(f);
  if (n === 0)
    return todo(
      f.fields.total === 0
        ? 'No customer fields yet.'
        : 'No customer field is mapped to a data source yet.',
    );
  const mapped = `${plural(n, 'field')} mapped`;
  return testedFields(f.connection, mapped);
}

function testedFields(c: Exclude<ConnectionFact, { kind: 'none' }>, mapped: string): StepResult {
  if (c.kind === 'env') return done(`${mapped}.`);
  if (!c.lastTest) return todo(`${mapped}. Press Test on Customer data to check them.`);
  if (!c.lastTest.ok) return broken(`${mapped}, but the last test failed: ${c.lastTest.detail}`);
  return done(`${mapped} and tested.`, c.lastTest.at);
}

function signInStep(f: OnboardingFacts): StepResult {
  if (f.handOverAt)
    return done('A customer arrived from your product with a valid hand-over token.', f.handOverAt);
  if (f.connection.kind === 'none')
    return todo('Connect your data first: hand-over tokens are checked with its signing secret.');
  return todo('Waiting for the first customer to arrive with a valid hand-over token.');
}

function widgetStep(f: OnboardingFacts): StepResult {
  if (!f.embedded)
    return broken(
      'Widget embedding is switched off on this support server, so no website can show it. Ask your support provider to turn it on.',
    );
  const load = f.widgetLoad;
  if (load && !f.allowedOrigins.includes(load.origin))
    return broken(`It last loaded on ${load.origin}, which is no longer an allowed website.`);
  if (load) return done(`The widget loaded on ${load.origin}.`, load.at);
  if (f.allowedOrigins.length === 0)
    return todo('Allow your website first, then open a page that has the widget.');
  return todo('Waiting for the widget to load on one of your allowed websites.');
}

const BUILDERS: Record<OnboardingStepId, (f: OnboardingFacts) => StepResult> = {
  connect: connectStep,
  fields: fieldsStep,
  signIn: signInStep,
  widget: widgetStep,
  origins: originsStep,
  teach: teachStep,
  extras: extrasStep,
  test: testStep,
};

/** The eight steps, in order, each from a real check (never from a click). */
export function buildSteps(facts: OnboardingFacts): OnboardingStep[] {
  return (Object.keys(BUILDERS) as OnboardingStepId[]).map((id) => {
    const r = BUILDERS[id](facts);
    return {
      id,
      state: r.state,
      optional: OPTIONAL_ONBOARDING_STEPS.includes(id),
      detail: clip(r.detail),
      at: r.at ? r.at.toISOString() : null,
    };
  });
}

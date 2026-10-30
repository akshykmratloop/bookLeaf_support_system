import type { OnboardingStep } from '@bookleaf/shared';
import { AlertCircle, CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Pill, type Tone } from '../atoms/Pill';
import { CodeSample } from '../molecules/CodeSample';
import { dateTime } from '../../lib/format';
import { docsHref, type StepCopy } from '../../lib/onboardingSteps';

const STATE: Record<OnboardingStep['state'], { text: string; tone: Tone; icon: ReactNode }> = {
  done: { text: 'Done', tone: 'success', icon: <CheckCircle2 size={20} aria-hidden /> },
  todo: { text: 'To do', tone: 'neutral', icon: <Circle size={20} aria-hidden /> },
  broken: { text: 'Needs attention', tone: 'danger', icon: <AlertCircle size={20} aria-hidden /> },
};
const ICON_COLOUR: Record<OnboardingStep['state'], string> = {
  done: 'text-success',
  todo: 'text-ink-3',
  broken: 'text-danger',
};

const linkClass =
  'inline-flex h-8 items-center gap-1.5 rounded-control border border-line bg-panel px-3 text-[12.5px] font-semibold text-ink-2 hover:border-brand hover:text-ink focus-visible:outline-2 focus-visible:outline-brand';

interface Props {
  number: number;
  step: OnboardingStep;
  copy: StepCopy;
  docsUrl: string | null;
  /** The filled-in code sample, when the step has one. */
  sample?: { label: string; code: string };
  /** Extra controls (the "Test it" step's actions). */
  children?: ReactNode;
}

function Links({ copy, docsUrl }: Pick<Props, 'copy' | 'docsUrl'>) {
  const href = docsHref(docsUrl, copy.docs);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {copy.links.map((l) => (
        <Link key={l.label} to={l.to} className={linkClass}>
          {l.label}
        </Link>
      ))}
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className={linkClass}>
          Guide: {copy.docs.label} <ExternalLink size={12} aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : (
        <span className="text-[12px] text-ink-3">
          Guide: <code className="font-mono">docs/integration.md</code> {copy.docs.label}
        </span>
      )}
    </div>
  );
}

function Detail({ step }: { step: OnboardingStep }) {
  const tone = step.state === 'broken' ? 'text-danger' : 'text-ink-2';
  return (
    <p className={`text-[12.5px] ${tone}`}>
      {step.detail}
      {step.at ? <span className="text-ink-3"> · {dateTime(step.at)}</span> : null}
    </p>
  );
}

/** One step of the setup guide: its state from the server, what to do, and where to do it. */
export function SetupStepCard({ number, step, copy, docsUrl, sample, children }: Props) {
  const state = STATE[step.state];
  const headingId = `setup-step-${step.id}`;
  const border = step.state === 'broken' ? 'border-danger/60' : '';
  return (
    <li
      aria-labelledby={headingId}
      className={`flex min-w-0 gap-3 rounded-card border border-line bg-panel p-4 shadow-soft sm:p-5 ${border}`}
    >
      <span className={`mt-0.5 shrink-0 ${ICON_COLOUR[step.state]}`}>{state.icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id={headingId} className="text-[15px] font-semibold text-ink">
            <span className="text-ink-3">{number}. </span>
            {copy.title}
          </h2>
          <Pill tone={state.tone} dot>
            {state.text}
          </Pill>
          {step.optional ? <Pill>Optional</Pill> : null}
        </div>
        <p className="text-[13px] text-ink-2">{copy.body}</p>
        <Detail step={step} />
        {sample ? <CodeSample label={sample.label} code={sample.code} /> : null}
        {children}
        <Links copy={copy} docsUrl={docsUrl} />
      </div>
    </li>
  );
}

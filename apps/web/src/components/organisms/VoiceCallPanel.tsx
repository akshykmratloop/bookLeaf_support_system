import { useQueryClient } from '@tanstack/react-query';
import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { useEffect } from 'react';
import { resumableKey, useResumableCall } from '../../lib/ticketDrafts';
import type { VoiceCallControls } from '../../lib/voice/useVoiceCall';
import { canStart } from '../../lib/voice/view';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { Pill } from '../atoms/Pill';
import { CallStartButtons } from '../molecules/CallStartButtons';
import { ChatBubble } from '../molecules/ChatBubble';
import { VoiceAfterCall } from './VoiceAfterCall';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const PHASE_TEXT = {
  starting: 'Starting the call…',
  connecting: 'Connecting to BookLeaf support…',
  ending: 'Ending the call…',
} as const;

interface Props {
  call: VoiceCallControls;
  maxSeconds: number;
  callsPerHour: number;
}

function LiveControls({ call }: { call: VoiceCallControls }) {
  const { view, hangup, toggleMute } = call;
  const live = view.phase === 'live';
  return (
    <>
      <Button
        variant="secondary"
        onClick={toggleMute}
        disabled={!live}
        icon={view.muted ? <MicOff size={14} aria-hidden /> : <Mic size={14} aria-hidden />}
      >
        {view.muted ? 'Unmute' : 'Mute'}
      </Button>
      <Button variant="danger" onClick={hangup} icon={<PhoneOff size={14} aria-hidden />}>
        End call
      </Button>
    </>
  );
}

function LiveTranscript({ lines }: { lines: VoiceCallControls['view']['lines'] }) {
  const first = Math.max(0, lines.length - 6);
  return (
    <ol className="flex max-h-none flex-col gap-2" aria-label="Live transcript">
      {lines.slice(first).map((l, i) => (
        <ChatBubble
          key={`line-${first + i}`}
          message={{ role: l.role, body: l.text, source: null, factsUsed: [] }}
        />
      ))}
    </ol>
  );
}

function CallHeader({
  view,
  maxSeconds,
  callsPerHour,
}: {
  view: VoiceCallControls['view'];
  maxSeconds: number;
  callsPerHour: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-[15px] font-semibold">Talk to BookLeaf support</p>
        <p className="text-[12.5px] text-ink-3">
          Up to {Math.round(maxSeconds / 60)} minutes per call · {callsPerHour} calls per hour. The
          assistant can fill in a ticket with you as you talk.
        </p>
      </div>
      {view.phase === 'live' && view.secondsLeft !== null ? (
        <Pill tone={view.timeWarning ? 'warning' : 'brand'} dot>
          <span aria-live="polite">{clock(view.secondsLeft)} left</span>
        </Pill>
      ) : null}
    </div>
  );
}

/** What the call shows now: progress, an error, the live transcript or the after-call view. */
function CallBody({ view }: { view: VoiceCallControls['view'] }) {
  if (view.phase in PHASE_TEXT)
    return (
      <p className="text-[13px] text-ink-2" aria-live="polite">
        {PHASE_TEXT[view.phase as keyof typeof PHASE_TEXT]}
      </p>
    );
  if (view.phase === 'failed')
    return (
      <p role="alert" className="text-[13px] text-danger">
        {view.error}
      </p>
    );
  if (view.phase === 'ended' && view.callId)
    return <VoiceAfterCall callId={view.callId} reason={view.endReason} />;
  if (view.phase !== 'live') return null;
  return (
    <>
      {view.lines.length ? <LiveTranscript lines={view.lines} /> : null}
      {view.draft?.subject ? (
        <p className="text-[12.5px] text-success">
          The assistant is preparing a ticket. You can see and edit it as you talk.
        </p>
      ) : null}
    </>
  );
}

/** Browser voice call with a visible countdown; the server enforces the same hard limit. */
export function VoiceCallPanel({ call, maxSeconds, callsPerHour }: Props) {
  const { view, start } = call;
  const qc = useQueryClient();
  const idle = canStart(view.phase);
  const resumable = useResumableCall(idle);
  // A call that just ended may now be one the author can continue.
  useEffect(() => {
    if (view.phase === 'ended') void qc.invalidateQueries({ queryKey: resumableKey });
  }, [view.phase, qc]);
  const busy = view.phase === 'starting' || view.phase === 'connecting' || view.phase === 'ending';
  const live = view.phase === 'live';
  return (
    <Card className="flex flex-col gap-4 p-5">
      <CallHeader view={view} maxSeconds={maxSeconds} callsPerHour={callsPerHour} />
      <CallBody view={view} />
      <div className="flex flex-wrap gap-2">
        {live || view.phase === 'connecting' ? (
          <LiveControls call={call} />
        ) : (
          <CallStartButtons
            resumable={idle ? (resumable.data ?? null) : null}
            isBusy={busy}
            hasCalled={view.phase === 'ended' || view.phase === 'failed'}
            onStart={start}
          />
        )}
      </div>
    </Card>
  );
}

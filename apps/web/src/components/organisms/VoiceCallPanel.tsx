import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { useVoiceCall } from '../../lib/voice/useVoiceCall';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { Pill } from '../atoms/Pill';
import { ChatBubble } from '../molecules/ChatBubble';
import { VoiceAfterCall } from './VoiceAfterCall';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const PHASE_TEXT = {
  starting: 'Starting the call…',
  connecting: 'Connecting to BookLeaf support…',
  ending: 'Ending the call…',
} as const;

interface Props {
  maxSeconds: number;
  callsPerHour: number;
}

/** Browser voice call with a visible countdown; the server enforces the same hard limit. */
export function VoiceCallPanel({ maxSeconds, callsPerHour }: Props) {
  const { view, start, hangup, toggleMute } = useVoiceCall();
  const busy = view.phase === 'starting' || view.phase === 'connecting' || view.phase === 'ending';
  const live = view.phase === 'live';
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold">Talk to BookLeaf support</p>
          <p className="text-[12.5px] text-ink-3">
            Up to {Math.round(maxSeconds / 60)} minutes per call · {callsPerHour} calls per hour.
            The call is transcribed so you can raise a ticket afterwards.
          </p>
        </div>
        {live && view.secondsLeft !== null ? (
          <Pill tone={view.timeWarning ? 'warning' : 'brand'} dot>
            <span aria-live="polite">{clock(view.secondsLeft)} left</span>
          </Pill>
        ) : null}
      </div>
      {busy ? (
        <p className="text-[13px] text-ink-2" aria-live="polite">
          {PHASE_TEXT[view.phase as keyof typeof PHASE_TEXT]}
        </p>
      ) : null}
      {view.phase === 'failed' ? (
        <p role="alert" className="text-[13px] text-danger">
          {view.error}
        </p>
      ) : null}
      {live && view.lines.length ? (
        <ol className="flex max-h-none flex-col gap-2" aria-label="Live transcript">
          {view.lines.slice(-6).map((l, i) => (
            <ChatBubble
              key={i}
              message={{ role: l.role, body: l.text, source: null, factsUsed: [] }}
            />
          ))}
        </ol>
      ) : null}
      {live && view.ticketSuggested ? (
        <p className="text-[12.5px] text-success">
          A ticket has been prepared. You can review and send it when the call ends.
        </p>
      ) : null}
      {view.phase === 'ended' && view.callId ? (
        <VoiceAfterCall callId={view.callId} reason={view.endReason} />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {live || view.phase === 'connecting' ? (
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
        ) : (
          <Button onClick={start} isLoading={busy} icon={<Phone size={14} aria-hidden />}>
            {view.phase === 'ended' || view.phase === 'failed'
              ? 'Start a new call'
              : 'Start a call'}
          </Button>
        )}
      </div>
    </Card>
  );
}

import { Mic, MicOff, PhoneOff } from 'lucide-react';
import type { CallView } from '../../lib/voice/view';
import type { VoiceCallControls } from '../../lib/voice/useVoiceCall';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const STATUS: Partial<Record<CallView['phase'], string>> = {
  starting: 'Starting the call…',
  connecting: 'Connecting to BookLeaf…',
  live: 'On a call with BookLeaf',
  ending: 'Ending the call…',
};

/** True while the call bar takes the message box's place. */
export const isCallActive = (phase: CallView['phase']) => phase in STATUS;

const BARS = [0, 1, 2, 3, 4];

/** Five bars that move while the call is live, like a voice-mode waveform. */
function Waveform({ live }: { live: boolean }) {
  return (
    <span aria-hidden className="flex h-6 items-center gap-[3px]">
      {BARS.map((i) => (
        <span
          key={i}
          style={{ animationDelay: `${i * 0.12}s` }}
          className={`h-full w-[3px] origin-center rounded-full bg-white ${live ? 'animate-wave' : 'scale-y-[0.35] opacity-70'}`}
        />
      ))}
    </span>
  );
}

const ROUND =
  'grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40';

/** The live call, in the chat box: what is happening, time left, mute and end. */
export function ChatCallBar({ call }: { call: VoiceCallControls }) {
  const { view, hangup, toggleMute } = call;
  const live = view.phase === 'live';
  const canEnd = live || view.phase === 'connecting';
  return (
    <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-app via-app to-transparent pt-4 pb-1">
      <div
        role="group"
        aria-label="Call in progress"
        className="flex items-center gap-3 rounded-[24px] border border-brand/30 bg-panel p-2 pl-2 shadow-lift"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-bright to-brand">
          <Waveform live={live} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold" aria-live="polite">
            {STATUS[view.phase]}
          </p>
          <p className={`text-[11.5px] ${view.timeWarning ? 'text-warning' : 'text-ink-3'}`}>
            {live && view.secondsLeft !== null
              ? `${clock(view.secondsLeft)} left · just speak, it listens`
              : 'Your words appear in the chat as you talk'}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleMute}
          disabled={!live}
          aria-pressed={view.muted}
          aria-label={view.muted ? 'Unmute' : 'Mute'}
          className={`${ROUND} ${view.muted ? 'bg-warning-bg text-warning' : 'bg-panel-2 text-ink-2 hover:text-ink'}`}
        >
          {view.muted ? <MicOff size={17} aria-hidden /> : <Mic size={17} aria-hidden />}
        </button>
        <button
          type="button"
          onClick={hangup}
          disabled={!canEnd}
          aria-label="End call"
          className={`${ROUND} bg-danger text-white hover:opacity-90`}
        >
          <PhoneOff size={17} aria-hidden />
        </button>
      </div>
    </div>
  );
}

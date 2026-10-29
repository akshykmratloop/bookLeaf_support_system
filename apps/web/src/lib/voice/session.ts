import {
  VoiceServerMessageSchema,
  type StartVoiceCall,
  type VoiceServerMessage,
} from '@bookleaf/shared';
import { api, errorMessage } from '../api';
import { openMicrophone, type Microphone } from './microphone';
import { PcmPlayer } from './player';
import { canStart, closeMessage, INITIAL_VIEW, micMessage, type CallView } from './view';

export type { CallPhase, CallView } from './view';

export interface StartCallOptions {
  /** Continue the last dropped call (same conversation and draft). */
  resume?: boolean;
  /** The chat this call joins: it hears the chat so far and its lines are saved into it. */
  chatSessionId?: string;
}

const HANGUP_GRACE_MS = 3000;
/** Longest the goodbye may keep playing after the server ends the call. */
const DRAIN_LIMIT_MS = 8000;

/** One browser voice call: mic → socket → BookLeaf server, and the assistant's audio back. */
export class VoiceCallSession {
  private view: CallView = INITIAL_VIEW;
  private readonly listeners = new Set<() => void>();
  private mic: Microphone | null = null;
  private player: PcmPlayer | null = null;
  private ws: WebSocket | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private hangupTimer: ReturnType<typeof setTimeout> | null = null;
  private releaseTimer: ReturnType<typeof setTimeout> | null = null;
  private release: (() => void) | null = null;
  /** Bumped by dispose(): a start() still awaiting the mic or the server then gives up. */
  private generation = 0;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  snapshot = () => this.view;

  private set(patch: Partial<CallView>) {
    this.view = { ...this.view, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  /**
   * Mic first (so a denied mic never creates a call), then the call, then the socket. With
   * `resume`, the server continues the last dropped call; with `chatSessionId`, the call joins
   * that chat.
   */
  async start(opts: StartCallOptions = {}): Promise<void> {
    if (!canStart(this.view.phase)) return;
    this.releaseNow();
    const gen = this.generation;
    this.set({ ...INITIAL_VIEW, phase: 'starting' });
    let call: StartVoiceCall;
    try {
      this.mic = await openMicrophone((chunk) => this.sendAudio(chunk));
      if (gen !== this.generation) return this.cleanup();
      call = await api<StartVoiceCall>('/voice/calls', {
        method: 'POST',
        body: {
          resume: opts.resume ?? false,
          ...(opts.chatSessionId ? { chatSessionId: opts.chatSessionId } : {}),
        },
      });
    } catch (err) {
      if (gen === this.generation) this.fail(micMessage(err, errorMessage(err)));
      else this.cleanup();
      return;
    }
    if (gen !== this.generation || !this.mic) return this.cleanup();
    this.player = new PcmPlayer(this.mic.ctx);
    this.set({ phase: 'connecting', callId: call.id });
    this.openSocket(call);
  }

  hangup(): void {
    if (this.view.phase !== 'live' && this.view.phase !== 'connecting') return;
    this.set({ phase: 'ending' });
    const ws = this.ws;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'hangup' }));
    this.hangupTimer = setTimeout(() => ws?.close(), HANGUP_GRACE_MS);
  }

  toggleMute(): void {
    const muted = !this.view.muted;
    this.mic?.setMuted(muted);
    this.set({ muted });
  }

  /** Back to idle after a finished call (New conversation); a goodbye still playing finishes. */
  reset(): void {
    if (this.view.phase === 'ended' || this.view.phase === 'failed') this.set(INITIAL_VIEW);
  }

  dispose(): void {
    this.generation += 1;
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) this.ws.close();
    this.cleanup();
    this.releaseNow();
  }

  /** The server's absolute URL (API on another site, with a ticket), else the path on this host. */
  private openSocket(call: Pick<StartVoiceCall, 'socketPath' | 'socketUrl'>) {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(
      call.socketUrl ?? `${scheme}://${window.location.host}${call.socketPath}`,
    );
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (e: MessageEvent<ArrayBuffer | string>) => this.onMessage(e.data);
    ws.onclose = (e) => this.onClose(e.code);
    this.ws = ws;
  }

  private sendAudio(chunk: ArrayBuffer) {
    if (this.view.phase === 'live' && this.ws?.readyState === WebSocket.OPEN) this.ws.send(chunk);
  }

  private onMessage(data: ArrayBuffer | string) {
    if (typeof data !== 'string') return this.player?.enqueue(data);
    const parsed = VoiceServerMessageSchema.safeParse(JSON.parse(data));
    if (parsed.success) this.onControl(parsed.data);
  }

  private onControl(m: VoiceServerMessage) {
    if (m.type === 'ready') {
      if (this.view.phase === 'connecting') this.goLive(m.maxSeconds);
    } else if (m.type === 'transcript')
      this.set({ lines: [...this.view.lines, { role: m.role, text: m.text }] });
    else if (m.type === 'interrupt') this.player?.flush();
    else if (m.type === 'time_warning') this.set({ timeWarning: true });
    else if (m.type === 'draft') this.set({ draft: m.draft });
    else if (m.type === 'ended') {
      this.set({ phase: 'ended', endReason: m.reason });
      this.cleanup(true);
    }
  }

  private goLive(maxSeconds: number) {
    const deadline = Date.now() + maxSeconds * 1000;
    this.set({ phase: 'live', secondsLeft: maxSeconds });
    this.ticker = setInterval(() => {
      this.set({ secondsLeft: Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) });
    }, 250);
  }

  private onClose(code: number) {
    if (this.view.phase === 'ended' || this.view.phase === 'failed') return;
    if (this.view.phase === 'connecting') return this.fail(closeMessage(code));
    const endReason = this.view.phase === 'ending' ? 'USER_HANGUP' : 'DISCONNECTED';
    this.set({ phase: 'ended', endReason: this.view.endReason ?? endReason });
    this.cleanup();
  }

  private fail(message: string) {
    this.set({ phase: 'failed', error: message });
    this.cleanup();
  }

  /**
   * Stops the mic at once. With `drain`, the assistant's last words (the goodbye) keep playing
   * for up to 8 s before the audio device is released.
   */
  private cleanup(drain = false) {
    if (this.ticker) clearInterval(this.ticker);
    if (this.hangupTimer) clearTimeout(this.hangupTimer);
    this.ticker = null;
    this.hangupTimer = null;
    const { mic, player } = this;
    this.mic = null;
    this.player = null;
    mic?.stop();
    const release = () => {
      player?.flush();
      mic?.close();
      this.release = null;
    };
    const wait = drain ? Math.min(player?.remainingMs() ?? 0, DRAIN_LIMIT_MS) : 0;
    if (wait === 0) return release();
    this.release = release;
    this.releaseTimer = setTimeout(release, wait);
  }

  private releaseNow() {
    if (this.releaseTimer) clearTimeout(this.releaseTimer);
    this.releaseTimer = null;
    this.release?.();
  }
}

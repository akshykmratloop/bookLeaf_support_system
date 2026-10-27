import { VOICE_SAMPLE_RATE } from '@bookleaf/shared';

/**
 * Plays the assistant's PCM16 24 kHz audio gap-free by scheduling each chunk right after the
 * previous one. `flush()` stops everything queued, for when the caller talks over the assistant.
 */
export class PcmPlayer {
  private nextStart = 0;
  private readonly playing = new Set<AudioBufferSourceNode>();

  constructor(private readonly ctx: AudioContext) {}

  enqueue(pcm16: ArrayBuffer): void {
    const samples = new Int16Array(pcm16);
    if (samples.length === 0) return;
    const buffer = this.ctx.createBuffer(1, samples.length, VOICE_SAMPLE_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) channel[i] = (samples[i] ?? 0) / 0x8000;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);
    const startAt = Math.max(this.ctx.currentTime + 0.02, this.nextStart);
    source.start(startAt);
    this.nextStart = startAt + buffer.duration;
    this.playing.add(source);
    source.onended = () => this.playing.delete(source);
  }

  /** Milliseconds until everything queued has played (0 when silent). */
  remainingMs(): number {
    if (this.playing.size === 0) return 0;
    return Math.max(0, (this.nextStart - this.ctx.currentTime) * 1000);
  }

  flush(): void {
    for (const source of this.playing) {
      try {
        source.stop();
      } catch {
        // Already stopped: nothing to do.
      }
    }
    this.playing.clear();
    this.nextStart = 0;
  }
}

/* global AudioWorkletProcessor, sampleRate, registerProcessor -- AudioWorklet scope globals */
/**
 * Runs on the browser's audio thread. Converts microphone audio (any device rate) to mono PCM16
 * at 24 kHz and posts ~40 ms chunks to the page, which sends them on the call socket.
 * Linear interpolation is enough for speech; the browser already applies echo cancellation.
 */
const TARGET_RATE = 24000;
const CHUNK_SAMPLES = 960; // 40 ms at 24 kHz

class VoiceCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = sampleRate / TARGET_RATE;
    this.position = 0;
    this.previous = 0;
    this.out = new Int16Array(CHUNK_SAMPLES);
    this.filled = 0;
  }

  push(sample) {
    const clamped = Math.max(-1, Math.min(1, sample));
    this.out[this.filled] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    this.filled += 1;
    if (this.filled === CHUNK_SAMPLES) {
      this.port.postMessage(this.out.buffer, [this.out.buffer]);
      this.out = new Int16Array(CHUNK_SAMPLES);
      this.filled = 0;
    }
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    // Walk the input at the target rate, interpolating between neighbouring samples.
    while (this.position < channel.length) {
      const index = Math.floor(this.position);
      const frac = this.position - index;
      const a = index === 0 ? this.previous : channel[index - 1];
      const b = channel[index];
      this.push(a + (b - a) * frac);
      this.position += this.step;
    }
    this.position -= channel.length;
    this.previous = channel[channel.length - 1];
    return true;
  }
}

registerProcessor('voice-capture', VoiceCaptureProcessor);

/** Echo cancellation matters most: without it the assistant hears itself and interrupts itself. */
const CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
};

export interface Microphone {
  /** Also used to play the assistant's audio, so it outlives `stop()`. */
  ctx: AudioContext;
  setMuted(muted: boolean): void;
  /** Stops capturing (the browser's mic indicator turns off); playback can continue. */
  stop(): void;
  /** Stops capturing and releases the audio device. */
  close(): void;
}

export class MicrophoneError extends Error {
  constructor(readonly reason: 'denied' | 'unavailable') {
    super(reason === 'denied' ? 'Microphone permission was denied' : 'No microphone is available');
    this.name = 'MicrophoneError';
  }
}

async function askForMic(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
  } catch (err) {
    const denied = err instanceof DOMException && err.name === 'NotAllowedError';
    throw new MicrophoneError(denied ? 'denied' : 'unavailable');
  }
}

/** Opens the mic and streams PCM16 24 kHz chunks to `onChunk` (from the capture worklet). */
export async function openMicrophone(onChunk: (pcm16: ArrayBuffer) => void): Promise<Microphone> {
  const stream = await askForMic();
  const stopTracks = () => stream.getTracks().forEach((t) => t.stop());
  const ctx = new AudioContext();
  let capture: AudioWorkletNode;
  let source: MediaStreamAudioSourceNode;
  try {
    await ctx.audioWorklet.addModule('/voice-capture-worklet.js');
    source = ctx.createMediaStreamSource(stream);
    capture = new AudioWorkletNode(ctx, 'voice-capture');
  } catch {
    // Never leave the mic on after a failed setup.
    stopTracks();
    void ctx.close();
    throw new MicrophoneError('unavailable');
  }
  let muted = false;
  capture.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
    onChunk(muted ? new ArrayBuffer(e.data.byteLength) : e.data);
  };
  source.connect(capture);
  const stop = () => {
    capture.port.onmessage = null;
    source.disconnect();
    capture.disconnect();
    stopTracks();
  };
  return {
    ctx,
    setMuted: (m) => {
      muted = m;
    },
    stop,
    close: () => {
      stop();
      if (ctx.state !== 'closed') void ctx.close();
    },
  };
}

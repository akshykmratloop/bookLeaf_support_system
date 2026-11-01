import { useEffect, useState, useSyncExternalStore } from 'react';

/** The parts of HTMLAudioElement the preview uses, so tests can pass a stand-in. */
export interface PreviewAudio {
  src: string;
  play: () => Promise<void>;
  pause: () => void;
  addEventListener: (type: 'ended' | 'error', listener: () => void) => void;
}

export interface VoicePreview {
  /** The voice whose sample is playing, or null. */
  playing: () => string | null;
  /** Plays this voice's sample, or stops it when it is the one already playing. */
  toggle: (voice: string, src: string) => void;
  stop: () => void;
  subscribe: (listener: () => void) => () => void;
}

/**
 * One player for every preview button: starting a sample stops the one before, so two voices
 * never talk over each other. Samples are pre-recorded static files: a preview costs nothing.
 */
export function createVoicePreview(makeAudio: () => PreviewAudio): VoicePreview {
  let audio: PreviewAudio | null = null;
  let current: string | null = null;
  const listeners = new Set<() => void>();
  const set = (voice: string | null) => {
    current = voice;
    listeners.forEach((listener) => listener());
  };
  const player = () => {
    if (audio) return audio;
    audio = makeAudio();
    audio.addEventListener('ended', () => set(null));
    audio.addEventListener('error', () => set(null));
    return audio;
  };
  const stop = () => {
    audio?.pause();
    if (current !== null) set(null);
  };
  const play = (voice: string, src: string) => {
    const el = player();
    el.pause();
    el.src = src;
    set(voice);
    // A refused play (browser autoplay rule, missing file) leaves nothing marked as playing.
    el.play().catch(() => {
      if (current === voice) set(null);
    });
  };
  return {
    playing: () => current,
    toggle: (voice, src) => (current === voice ? stop() : play(voice, src)),
    stop,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

let shared: VoicePreview | null = null;
const sharedPreview = () => (shared ??= createVoicePreview(() => new Audio()));
const noPlayer = () => null;

/** Which voice is playing, and a toggle; the sample stops when the screen closes. */
export function useVoicePreview() {
  const [preview] = useState(sharedPreview);
  const playing = useSyncExternalStore(preview.subscribe, preview.playing, noPlayer);
  useEffect(() => preview.stop, [preview]);
  return { playing, toggle: preview.toggle };
}

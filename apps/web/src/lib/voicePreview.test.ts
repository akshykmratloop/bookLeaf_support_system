import { describe, expect, it } from 'vitest';
import { createVoicePreview, type PreviewAudio } from './voicePreview';

class FakeAudio implements PreviewAudio {
  src = '';
  isPaused = true;
  played: string[] = [];
  refuse = false;
  private listeners: Record<string, (() => void)[]> = {};
  play() {
    if (this.refuse) return Promise.reject(new Error('NotAllowedError'));
    this.isPaused = false;
    this.played.push(this.src);
    return Promise.resolve();
  }
  pause() {
    this.isPaused = true;
  }
  addEventListener(type: 'ended' | 'error', listener: () => void) {
    (this.listeners[type] ??= []).push(listener);
  }
  fire(type: 'ended' | 'error') {
    this.listeners[type]?.forEach((l) => l());
  }
}

const setup = () => {
  const audio = new FakeAudio();
  let made = 0;
  const preview = createVoicePreview(() => {
    made += 1;
    return audio;
  });
  return { audio, preview, made: () => made };
};

describe('voice preview', () => {
  it('plays a sample and marks that voice as playing', () => {
    const { audio, preview } = setup();
    preview.toggle('marin', '/voice-samples/openai/marin.mp3');
    expect(audio.played).toEqual(['/voice-samples/openai/marin.mp3']);
    expect(preview.playing()).toBe('marin');
  });

  it('stops when the same voice is pressed again', () => {
    const { audio, preview } = setup();
    preview.toggle('marin', '/m.mp3');
    preview.toggle('marin', '/m.mp3');
    expect(audio.isPaused).toBe(true);
    expect(preview.playing()).toBeNull();
  });

  it('uses one player, so a new voice cuts off the one before', () => {
    const { audio, preview, made } = setup();
    preview.toggle('marin', '/m.mp3');
    preview.toggle('cedar', '/c.mp3');
    expect(made()).toBe(1);
    expect(audio.src).toBe('/c.mp3');
    expect(preview.playing()).toBe('cedar');
  });

  it('clears the playing voice when the sample ends or fails to load', () => {
    const { audio, preview } = setup();
    preview.toggle('marin', '/m.mp3');
    audio.fire('ended');
    expect(preview.playing()).toBeNull();
    preview.toggle('cedar', '/c.mp3');
    audio.fire('error');
    expect(preview.playing()).toBeNull();
  });

  it('clears the playing voice when the browser refuses to play', async () => {
    const { audio, preview } = setup();
    audio.refuse = true;
    preview.toggle('marin', '/m.mp3');
    await Promise.resolve();
    await Promise.resolve();
    expect(preview.playing()).toBeNull();
  });

  it('tells subscribers about each change, and stops telling them after unsubscribe', () => {
    const { preview } = setup();
    let calls = 0;
    const unsubscribe = preview.subscribe(() => (calls += 1));
    preview.toggle('marin', '/m.mp3');
    preview.stop();
    unsubscribe();
    preview.toggle('cedar', '/c.mp3');
    expect(calls).toBe(2);
  });
});

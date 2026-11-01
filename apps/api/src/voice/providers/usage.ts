/**
 * Tokens a speech model used, split the way speech models are priced: text and audio, and input
 * served from the provider's cache apart from fresh input. Vendor-neutral: each adapter maps its
 * own usage report onto this, and prices it.
 */
export interface VoiceUsage {
  /** Fresh (uncached) text input: instructions, tool results, notes. */
  textIn: number;
  /** Fresh (uncached) audio input: the caller's speech. */
  audioIn: number;
  cachedTextIn: number;
  cachedAudioIn: number;
  textOut: number;
  audioOut: number;
}

export const NO_VOICE_USAGE: Readonly<VoiceUsage> = Object.freeze({
  textIn: 0,
  audioIn: 0,
  cachedTextIn: 0,
  cachedAudioIn: 0,
  textOut: 0,
  audioOut: 0,
});

/** A new total; neither argument is changed. */
export function addVoiceUsage(a: VoiceUsage, b: VoiceUsage): VoiceUsage {
  return {
    textIn: a.textIn + b.textIn,
    audioIn: a.audioIn + b.audioIn,
    cachedTextIn: a.cachedTextIn + b.cachedTextIn,
    cachedAudioIn: a.cachedAudioIn + b.cachedAudioIn,
    textOut: a.textOut + b.textOut,
    audioOut: a.audioOut + b.audioOut,
  };
}

/** For the run log: all input (cached included), the cached part of it, and all output. */
export function voiceUsageTotals(u: VoiceUsage) {
  const cachedInputTokens = u.cachedTextIn + u.cachedAudioIn;
  return {
    inputTokens: u.textIn + u.audioIn + cachedInputTokens,
    cachedInputTokens,
    outputTokens: u.textOut + u.audioOut,
  };
}

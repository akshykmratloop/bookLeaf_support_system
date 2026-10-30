/** A speech-to-speech model a super admin may pick in the console (U-7). */
export interface VoiceModelInfo {
  id: string;
  label: string;
  tier: 'fast' | 'balanced' | 'strong';
}

/**
 * OpenAI Realtime models. gpt-realtime-2.1 is the server default (VOICE_MODEL); the other two are
 * the general-availability models in OpenAI's docs. Add a model here to offer it in the console.
 */
export const OPENAI_VOICE_MODELS: readonly VoiceModelInfo[] = [
  { id: 'gpt-realtime-2.1', label: 'GPT Realtime 2.1', tier: 'strong' },
  { id: 'gpt-realtime', label: 'GPT Realtime', tier: 'balanced' },
  { id: 'gpt-realtime-mini', label: 'GPT Realtime mini', tier: 'fast' },
];

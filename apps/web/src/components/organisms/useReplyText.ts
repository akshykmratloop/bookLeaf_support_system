import type { CheckResult, Draft } from '@bookleaf/shared';
import { useState } from 'react';
import {
  cleared,
  EMPTY_TEXTS,
  textFor,
  withText,
  type ComposerMode,
  type ComposerTexts,
} from '../../lib/composerTexts';

/**
 * The reply text, the internal note text (kept apart, U-3) and the reply's fact-check result. A
 * new AI draft replaces the reply only if it is empty or still holds the previous draft, so the
 * admin's own edits are never lost; the note is never touched by a draft.
 */
export function useReplyText(draft: Draft | null, mode: ComposerMode) {
  const [texts, setTexts] = useState<ComposerTexts>(EMPTY_TEXTS);
  const [loaded, setLoaded] = useState<{ id: string; body: string } | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);

  // Adjusting state during render, as React recommends over an effect.
  if (draft && draft.id !== loaded?.id) {
    const untouched = texts.reply.trim() === '' || texts.reply === loaded?.body;
    setLoaded({ id: draft.id, body: draft.body });
    if (untouched) {
      setTexts((t) => withText(t, 'REPLY', draft.body));
      setCheck(draft.check);
    }
  }

  return {
    text: textFor(texts, mode),
    check,
    setCheck,
    // Any reply edit makes the previous check result stale; the server re-checks on send anyway.
    setText: (value: string) => {
      setTexts((t) => withText(t, mode, value));
      if (mode === 'REPLY') setCheck(null);
    },
    useDraft: () => draft && setTexts((t) => withText(t, 'REPLY', draft.body)),
    /** Empties only the box that was sent. */
    clear: (sent: ComposerMode) => {
      setTexts((t) => cleared(t, sent));
      if (sent === 'REPLY') setCheck(null);
    },
  };
}

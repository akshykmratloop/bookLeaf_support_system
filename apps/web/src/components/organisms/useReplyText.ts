import type { CheckResult, Draft } from '@bookleaf/shared';
import { useState } from 'react';

/**
 * The reply text and its fact-check result. A new AI draft replaces the text only if the editor
 * is empty or still holds the previous draft, so the admin's own edits are never lost.
 */
export function useReplyText(draft: Draft | null) {
  const [text, setRawText] = useState('');
  const [loaded, setLoaded] = useState<{ id: string; body: string } | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);

  // Adjusting state during render, as React recommends over an effect.
  if (draft && draft.id !== loaded?.id) {
    const untouched = text.trim() === '' || text === loaded?.body;
    setLoaded({ id: draft.id, body: draft.body });
    if (untouched) {
      setRawText(draft.body);
      setCheck(draft.check);
    }
  }

  return {
    text,
    check,
    setCheck,
    // Any edit makes the previous check result stale; the server re-checks on send anyway.
    setText: (value: string) => {
      setRawText(value);
      setCheck(null);
    },
    useDraft: () => draft && setRawText(draft.body),
    clear: () => {
      setRawText('');
      setCheck(null);
    },
  };
}

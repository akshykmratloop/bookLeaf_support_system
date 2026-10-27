import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { MessageQueue } from './chatQueue';

const questionOf = (state: unknown): string | null =>
  typeof state === 'object' &&
  state !== null &&
  'question' in state &&
  typeof state.question === 'string'
    ? state.question
    : null;

/**
 * A question typed on Home arrives in the navigation state: send it once the chat is open, then
 * drop it from the history entry so a reload or Back does not send it again.
 */
export function useInitialQuestion(ready: boolean, queue: MessageQueue) {
  const location = useLocation();
  const navigate = useNavigate();
  const sent = useRef(false);
  const question = questionOf(location.state);
  useEffect(() => {
    if (!ready || !question || sent.current) return;
    sent.current = true;
    queue.add(question);
    void navigate(location.pathname, { replace: true, state: null });
  }, [ready, question, queue, navigate, location.pathname]);
}

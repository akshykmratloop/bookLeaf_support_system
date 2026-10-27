import type { TicketDraft } from '@bookleaf/shared';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { errorMessage } from './api';
import { DraftEditor } from './draftEditor';
import { editDraft, submitDraft } from './ticketDrafts';

/**
 * React view of the ticket draft form. `draft` is the latest version from the server (chat
 * reply or call message); `onSaved` receives each version the author's own saves return.
 */
export function useDraftEditor(draft: TicketDraft | null, onSaved: (d: TicketDraft) => void) {
  const [editor] = useState(
    () => new DraftEditor({ edit: editDraft, submit: submitDraft }, errorMessage),
  );
  useEffect(() => {
    editor.setOnSaved(onSaved);
  }, [editor, onSaved]);
  useEffect(() => editor.receive(draft), [editor, draft]);
  useEffect(() => () => editor.dispose(), [editor]);
  const view = useSyncExternalStore(editor.subscribe, editor.snapshot);
  return { view, editor };
}

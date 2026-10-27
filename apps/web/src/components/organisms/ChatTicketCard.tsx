import {
  DESCRIPTION_LIMITS,
  SUBJECT_LIMITS,
  type Book,
  type TicketProposal,
} from '@bookleaf/shared';
import { TicketPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { Input, Select, Textarea } from '../atoms/Input';
import { Field } from '../molecules/Field';

interface Props {
  proposal: TicketProposal;
  books: Book[];
  isSubmitting: boolean;
  onConfirm: (values: TicketProposal) => void;
  onDismiss: () => void;
}

/** The assistant's suggested ticket. Nothing is created until the author reviews and confirms. */
export function ChatTicketCard({ proposal, books, isSubmitting, onConfirm, onDismiss }: Props) {
  const [bookId, setBookId] = useState(proposal.bookId ?? '');
  const [subject, setSubject] = useState(proposal.subject);
  const [description, setDescription] = useState(proposal.description);
  const valid =
    subject.trim().length >= SUBJECT_LIMITS.min &&
    description.trim().length >= DESCRIPTION_LIMITS.min;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) onConfirm({ bookId: bookId || null, subject, description });
  };
  return (
    <Card className="border-brand/40 p-4">
      <form onSubmit={submit} className="flex flex-col gap-3" aria-label="Raise a ticket">
        <p className="flex items-center gap-2 text-[13px] font-semibold">
          <TicketPlus size={15} aria-hidden /> Raise a ticket with the support team
        </p>
        <p className="text-[12px] text-ink-3">
          Check the details below. The team replies on the ticket page.
        </p>
        <Field id="chat-ticket-book" label="Book">
          <Select id="chat-ticket-book" value={bookId} onChange={(e) => setBookId(e.target.value)}>
            <option value="">General / Account level</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="chat-ticket-subject" label="Subject">
          <Input
            id="chat-ticket-subject"
            value={subject}
            maxLength={SUBJECT_LIMITS.max}
            onChange={(e) => setSubject(e.target.value)}
          />
        </Field>
        <Field
          id="chat-ticket-description"
          label="Description"
          hint={`At least ${DESCRIPTION_LIMITS.min} characters.`}
        >
          <Textarea
            id="chat-ticket-description"
            rows={4}
            value={description}
            maxLength={DESCRIPTION_LIMITS.max}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Not now
          </Button>
          <Button type="submit" size="sm" disabled={!valid} isLoading={isSubmitting}>
            Raise ticket
          </Button>
        </div>
      </form>
    </Card>
  );
}

import { DESCRIPTION_LIMITS, SUBJECT_LIMITS, type Book } from '@bookleaf/shared';
import { Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../atoms/Button';
import { Input, Select, Textarea } from '../atoms/Input';
import { AttachmentPicker } from '../molecules/AttachmentPicker';
import { Field } from '../molecules/Field';

export interface TicketFormValues {
  bookId: string | null;
  subject: string;
  description: string;
}

interface Props {
  books: Book[];
  isSubmitting: boolean;
  serverError: (path: string) => string | undefined;
  onSubmit: (values: TicketFormValues) => void;
}

/** UX-only checks mirroring the server limits; the server remains the real gate. */
function localErrors(subject: string, description: string) {
  return {
    subject:
      subject.trim().length < SUBJECT_LIMITS.min
        ? `Please add a short subject (at least ${SUBJECT_LIMITS.min} characters).`
        : undefined,
    description:
      description.trim().length < DESCRIPTION_LIMITS.min
        ? `Please describe the issue in a little more detail (at least ${DESCRIPTION_LIMITS.min} characters).`
        : undefined,
  };
}

export function TicketForm({ books, isSubmitting, serverError, onSubmit }: Props) {
  const [bookId, setBookId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const local = localErrors(subject, description);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (local.subject || local.description) return;
    onSubmit({ bookId: bookId || null, subject, description });
  };
  const err = (path: 'subject' | 'description') =>
    (touched ? local[path] : undefined) ?? serverError(path);
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field id="book" label="Which book is this about?" error={serverError('bookId')}>
        <Select id="book" value={bookId} onChange={(e) => setBookId(e.target.value)}>
          <option value="">General / Account level</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        id="subject"
        label="Subject"
        error={err('subject')}
        counter={`${subject.length}/${SUBJECT_LIMITS.max}`}
      >
        <Input
          id="subject"
          value={subject}
          maxLength={SUBJECT_LIMITS.max}
          onChange={(e) => setSubject(e.target.value)}
          aria-invalid={Boolean(err('subject'))}
          placeholder="e.g. I haven't received my royalty"
        />
      </Field>
      <Field
        id="description"
        label="Details"
        error={err('description')}
        counter={`${description.length}/${DESCRIPTION_LIMITS.max}`}
        hint="Include dates, platforms or order numbers if you have them."
      >
        <Textarea
          id="description"
          rows={7}
          value={description}
          maxLength={DESCRIPTION_LIMITS.max}
          onChange={(e) => setDescription(e.target.value)}
          aria-invalid={Boolean(err('description'))}
        />
      </Field>
      <AttachmentPicker files={files} onChange={setFiles} />
      <div className="flex justify-end">
        <Button type="submit" isLoading={isSubmitting} icon={<Send size={15} aria-hidden />}>
          Submit ticket
        </Button>
      </div>
    </form>
  );
}

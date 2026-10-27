import { DESCRIPTION_LIMITS, SUBJECT_LIMITS, type Book } from '@bookleaf/shared';
import { Paperclip, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../atoms/Button';
import { Input, Select, Textarea } from '../atoms/Input';
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

const MAX_FILES = 3;

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
      <Field
        id="files"
        label="Attachments (optional)"
        hint="Screenshots or photos help us verify issues faster. In this demo, files are not uploaded."
      >
        <label
          htmlFor="files"
          className="flex h-[38px] cursor-pointer items-center gap-2 rounded-[9px] border border-dashed border-line-strong bg-inset px-3 text-[13px] text-ink-2 hover:border-brand"
        >
          <Paperclip size={14} aria-hidden />
          {files.length ? files.join(', ') : 'Choose up to 3 images or PDFs'}
        </label>
        <input
          id="files"
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={(e) =>
            setFiles([...(e.target.files ?? [])].slice(0, MAX_FILES).map((f) => f.name))
          }
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" isLoading={isSubmitting} icon={<Send size={15} aria-hidden />}>
          Submit ticket
        </Button>
      </div>
    </form>
  );
}

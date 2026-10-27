import {
  CATEGORY_LABELS,
  DESCRIPTION_LIMITS,
  SUBJECT_LIMITS,
  TICKET_CATEGORIES,
  type Book,
  type TicketCategory,
} from '@bookleaf/shared';
import type { DraftField, DraftValues } from '../../lib/draftEditor';
import { Input, Select, Textarea } from '../atoms/Input';
import { Field } from './Field';

interface Props {
  values: DraftValues;
  books: Book[];
  disabled: boolean;
  highlighted: DraftField[];
  onChange: <F extends DraftField>(field: F, value: DraftValues[F]) => void;
}

/** A field the assistant just changed glows briefly, so the author sees what moved. */
const glow = (on: boolean) => (on ? 'ring-2 ring-brand/50 transition-shadow' : 'transition-shadow');

/** Issue type, book, subject and description of the shared ticket draft. */
export function DraftFields({ values, books, disabled, highlighted, onChange }: Props) {
  const lit = (f: DraftField) => glow(highlighted.includes(f));
  return (
    <div className="flex flex-col gap-3">
      <Field id="draft-category" label="Issue type">
        <Select
          id="draft-category"
          className={lit('category')}
          value={values.category}
          disabled={disabled}
          onChange={(e) => onChange('category', e.target.value as TicketCategory | '')}
        >
          <option value="">Choose an issue type</option>
          {TICKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="draft-book" label="Book">
        <Select
          id="draft-book"
          className={lit('bookId')}
          value={values.bookId}
          disabled={disabled}
          onChange={(e) => onChange('bookId', e.target.value)}
        >
          <option value="">General / Account level</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        id="draft-subject"
        label="Subject"
        counter={`${values.subject.length}/${SUBJECT_LIMITS.max}`}
      >
        <Input
          id="draft-subject"
          className={lit('subject')}
          value={values.subject}
          maxLength={SUBJECT_LIMITS.max}
          disabled={disabled}
          placeholder="A short summary"
          onChange={(e) => onChange('subject', e.target.value)}
        />
      </Field>
      <Field
        id="draft-description"
        label="Description"
        counter={`${values.description.length}/${DESCRIPTION_LIMITS.max}`}
      >
        <Textarea
          id="draft-description"
          className={lit('description')}
          rows={7}
          value={values.description}
          maxLength={DESCRIPTION_LIMITS.max}
          disabled={disabled}
          placeholder="What happened, and what you need from the team"
          onChange={(e) => onChange('description', e.target.value)}
        />
      </Field>
    </div>
  );
}

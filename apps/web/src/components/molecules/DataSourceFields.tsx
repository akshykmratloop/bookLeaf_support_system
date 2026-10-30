import { Trash2 } from 'lucide-react';
import type { SourceDraft } from '../../lib/dataSources';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Dropdown, type DropdownOption } from './Dropdown';
import { Field } from './Field';

const FORMAT_OPTIONS: DropdownOption<SourceDraft['format']>[] = [
  { value: 'MAPPED', label: 'Any JSON — map it on the Customer data page' },
  { value: 'CONTRACT', label: 'Full customer shape (docs/integration.md)' },
];

interface Props {
  index: number;
  draft: SourceDraft;
  canRemove: boolean;
  /** The message for one of this source's fields (`name`, `urlTemplate`, ...). */
  errorOf: (field: keyof SourceDraft) => string | undefined;
  onChange: (patch: Partial<SourceDraft>) => void;
  onRemove: () => void;
}

/** One data source of the product connection: a name, a GET URL template and its own limits. */
export function DataSourceFields({ index, draft, canRemove, errorOf, onChange, onRemove }: Props) {
  const id = (name: string) => `source-${index}-${name}`;
  return (
    <fieldset className="flex flex-col gap-3 rounded-control border border-line p-4">
      <legend className="px-1 text-[12.5px] font-semibold text-ink-2">
        Data source {index + 1}
      </legend>
      <div className="grid gap-3 md:grid-cols-[1fr_1.4fr]">
        <Field
          id={id('name')}
          label="Name"
          hint="e.g. Profile, Books, Payouts"
          error={errorOf('name')}
        >
          <Input
            id={id('name')}
            value={draft.name}
            maxLength={40}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </Field>
        <Field id={id('format')} label="Answer format" error={errorOf('format')}>
          <Dropdown<SourceDraft['format']>
            id={id('format')}
            value={draft.format}
            options={FORMAT_OPTIONS}
            onChange={(format) => onChange({ format })}
          />
        </Field>
      </div>
      <Field
        id={id('url')}
        label="URL (GET)"
        hint="Use {id} and/or {email}, e.g. https://api.example.com/customers/{id}"
        error={errorOf('urlTemplate')}
      >
        <Input
          id={id('url')}
          value={draft.urlTemplate}
          inputMode="url"
          placeholder="https://api.example.com/customers/{id}"
          onChange={(e) => onChange({ urlTemplate: e.target.value })}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          id={id('auth')}
          label="Key header"
          hint="Empty: Authorization: Bearer"
          error={errorOf('authHeader')}
        >
          <Input
            id={id('auth')}
            value={draft.authHeader}
            placeholder="X-Api-Key"
            onChange={(e) => onChange({ authHeader: e.target.value })}
          />
        </Field>
        <Field id={id('timeout')} label="Timeout (ms)" error={errorOf('timeoutMs')}>
          <Input
            id={id('timeout')}
            type="number"
            min={200}
            max={10000}
            value={draft.timeoutMs}
            onChange={(e) => onChange({ timeoutMs: e.target.value })}
          />
        </Field>
        <Field id={id('cache')} label="Reuse for (s)" error={errorOf('cacheSeconds')}>
          <Input
            id={id('cache')}
            type="number"
            min={0}
            max={600}
            value={draft.cacheSeconds}
            onChange={(e) => onChange({ cacheSeconds: e.target.value })}
          />
        </Field>
      </div>
      {canRemove ? (
        <div>
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 size={14} aria-hidden />}
            onClick={onRemove}
            aria-label={`Remove data source ${draft.name || index + 1}`}
          >
            Remove source
          </Button>
        </div>
      ) : null}
    </fieldset>
  );
}

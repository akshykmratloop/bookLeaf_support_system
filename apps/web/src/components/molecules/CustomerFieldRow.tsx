import type { CustomerField } from '@bookleaf/shared';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Pill } from '../atoms/Pill';

interface Props {
  f: CustomerField;
  /** "Profile → data.plan" when the field is read from a data source (U-9). */
  mappedFrom: string | null;
  onEdit: () => void;
  onDelete: () => void;
}

/** One customer-data field in the list: key, type, meaning and where its value comes from. */
export function CustomerFieldRow({ f, mappedFrom, onEdit, onDelete }: Props) {
  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">
          <code className="font-mono text-[12px] break-all">{f.key}</code>
          <Pill tone="brand">{f.type}</Pill>
          {!f.visibleToCustomer ? <Pill>staff only</Pill> : null}
        </p>
        <p className="text-[12.5px] text-ink-2">
          {f.label}
          {f.description ? ` — ${f.description}` : ''}
        </p>
        {f.allowedValues.length ? (
          <p className="font-mono text-[11px] text-ink-3">{f.allowedValues.join(' · ')}</p>
        ) : null}
        {mappedFrom ? (
          <p className="font-mono text-[11px] break-all text-brand-ink">{mappedFrom}</p>
        ) : null}
      </div>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          icon={<Pencil size={14} aria-hidden />}
          onClick={onEdit}
          aria-label={`Edit ${f.key}`}
        >
          Edit
        </Button>
        <Button
          variant="danger"
          size="sm"
          icon={<Trash2 size={14} aria-hidden />}
          onClick={onDelete}
          aria-label={`Remove ${f.key}`}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}

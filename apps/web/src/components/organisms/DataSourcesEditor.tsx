import { MAX_DATA_SOURCES } from '@bookleaf/shared';
import { Plus } from 'lucide-react';
import { newSourceDraft, type SourceDraft } from '../../lib/dataSources';
import { Button } from '../atoms/Button';
import { DataSourceFields } from '../molecules/DataSourceFields';

interface Props {
  drafts: SourceDraft[];
  onChange: (drafts: SourceDraft[]) => void;
  /** The message for a request path such as `sources.1.urlTemplate`. */
  fieldError: (path: string) => string | undefined;
  /** A message about the list as a whole (too many, duplicate names). */
  listError?: string;
}

/** One to five data sources; each is called only when a mapped field needs it. */
export function DataSourcesEditor({ drafts, onChange, fieldError, listError }: Props) {
  const update = (i: number, patch: Partial<SourceDraft>) =>
    onChange(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const remove = (i: number) => onChange(drafts.filter((_, j) => j !== i));
  const add = () => onChange([...drafts, newSourceDraft(drafts.length)]);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-[13.5px] font-semibold">Data sources</p>
        <p className="text-[12.5px] text-ink-2">
          One endpoint is enough. Add more (up to {MAX_DATA_SOURCES}) when your data lives in
          several places; support calls them in parallel and merges the answers.
        </p>
      </div>
      {drafts.map((d, i) => (
        <DataSourceFields
          key={d.key}
          index={i}
          draft={d}
          canRemove={drafts.length > 1}
          errorOf={(field) => fieldError(`sources.${i}.${field}`)}
          onChange={(patch) => update(i, patch)}
          onRemove={() => remove(i)}
        />
      ))}
      {listError ? (
        <p role="alert" className="text-[12px] text-danger">
          {listError}
        </p>
      ) : null}
      {drafts.length < MAX_DATA_SOURCES ? (
        <div>
          <Button variant="secondary" size="sm" icon={<Plus size={14} aria-hidden />} onClick={add}>
            Add data source
          </Button>
        </div>
      ) : null}
    </div>
  );
}

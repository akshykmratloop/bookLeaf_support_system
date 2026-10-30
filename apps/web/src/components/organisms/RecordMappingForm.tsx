import type { Connector } from '@bookleaf/shared';
import { Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { errorMessage, isApiError } from '../../lib/api';
import {
  mappableSources,
  mappingDraftOf,
  toRecordMapping,
  type MappingDraft,
} from '../../lib/dataSources';
import { useApiMutation } from '../../lib/queries';
import { saveRecordMapping, workspaceKeys } from '../../lib/workspace';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { Input } from '../atoms/Input';
import { Field } from '../molecules/Field';
import { SourcePathPicker } from '../molecules/SourcePathPicker';
import { useToast } from '../molecules/Toast';

/**
 * Where the customer's name, email and item list (e.g. books) come from in "any JSON" sources.
 * A source in the full customer shape already brings them; mapped values are added on top.
 */
export function RecordMappingForm({ connector }: { connector: Connector }) {
  const toast = useToast();
  const sources = mappableSources(connector.sources);
  const [d, setD] = useState<MappingDraft>(() => mappingDraftOf(connector.mapping));
  const save = useApiMutation(saveRecordMapping, [workspaceKeys.connector]);
  const err = (p: string) =>
    isApiError(save.error) ? save.error.fieldError(`mapping.${p}`) : undefined;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      { version: connector.version, mapping: toRecordMapping(d) },
      {
        onSuccess: () => toast('success', 'Customer record mapping saved'),
        onError: (e2) => toast('error', errorMessage(e2)),
      },
    );
  };
  const items = d.items;
  return (
    <Card className="p-5">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div>
          <p className="text-[15px] font-semibold">Where the customer record comes from</p>
          <p className="text-[12.5px] text-ink-2">
            Needed only for sources that answer in any JSON. Use Test below to see each answer.
          </p>
        </div>
        {(['name', 'email'] as const).map((key) => (
          <SourcePathPicker
            key={key}
            id={`map-${key}`}
            label={key === 'name' ? 'Customer name from' : 'Customer email from'}
            sources={sources}
            value={d[key]}
            onChange={(v) => setD({ ...d, [key]: v })}
            sourceError={err(`${key}.sourceId`)}
            pathError={err(`${key}.path`)}
          />
        ))}
        <SourcePathPicker
          id="map-items"
          label="Item list (e.g. books) from"
          sources={sources}
          value={items}
          onChange={(v) => setD({ ...d, items: { ...items, ...v } })}
          pathLabel="Path to the list"
          pathHint="Must point at an array, e.g. data.books"
          sourceError={err('items.sourceId')}
          pathError={err('items.path')}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="map-item-id" label="Item id, inside each item" error={err('items.idPath')}>
            <Input
              id="map-item-id"
              className="font-mono"
              value={items.idPath}
              maxLength={200}
              placeholder="isbn"
              onChange={(e) => setD({ ...d, items: { ...items, idPath: e.target.value } })}
            />
          </Field>
          <Field id="map-item-title" label="Item title (optional)" error={err('items.titlePath')}>
            <Input
              id="map-item-title"
              className="font-mono"
              value={items.titlePath}
              maxLength={200}
              placeholder="title"
              onChange={(e) => setD({ ...d, items: { ...items, titlePath: e.target.value } })}
            />
          </Field>
        </div>
        <div>
          <Button type="submit" isLoading={save.isPending} icon={<Save size={15} aria-hidden />}>
            Save mapping
          </Button>
        </div>
      </form>
    </Card>
  );
}

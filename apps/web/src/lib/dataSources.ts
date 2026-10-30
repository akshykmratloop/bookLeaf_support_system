import type {
  CustomerField,
  DataSource,
  DataSourceFormat,
  RecordMapping,
  SaveConnectorRequest,
  SourceRef,
} from '@bookleaf/shared';

/** One source as the save request carries it. */
export type SourceInput = NonNullable<SaveConnectorRequest['sources']>[number];

/** One data source as the connection form edits it (numbers as typed text). */
export interface SourceDraft {
  /** Stable React key; a saved source's id when it has one. */
  key: string;
  id: string | null;
  name: string;
  urlTemplate: string;
  format: DataSourceFormat;
  /** Empty = the API key goes as `Authorization: Bearer`. */
  authHeader: string;
  timeoutMs: string;
  cacheSeconds: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Saved sources have a uuid; the default workspace's server-settings source is `env`. */
const isSaved = (id: string | null): id is string => id !== null && UUID.test(id);

let counter = 0;
const nextKey = () => `new-${(counter += 1)}`;

export function newSourceDraft(index: number, format: DataSourceFormat = 'MAPPED'): SourceDraft {
  return {
    key: nextKey(),
    id: null,
    name: format === 'CONTRACT' ? 'Customer' : `Source ${index + 1}`,
    urlTemplate: '',
    format,
    authHeader: '',
    timeoutMs: '3000',
    cacheSeconds: '60',
  };
}

/** The saved sources as drafts; one empty fixed-shape source when there are none yet. */
export function sourceDraftsOf(sources: DataSource[]): SourceDraft[] {
  if (sources.length === 0) return [newSourceDraft(0, 'CONTRACT')];
  return sources.map((s) => ({
    key: s.id,
    id: s.id,
    name: s.name,
    urlTemplate: s.urlTemplate,
    format: s.format,
    authHeader: s.authHeader ?? '',
    timeoutMs: String(s.timeoutMs),
    cacheSeconds: String(s.cacheSeconds),
  }));
}

/** Drafts as the API takes them; the server checks every value again. */
export function toSourceInputs(drafts: SourceDraft[]): SourceInput[] {
  return drafts.map((d) => ({
    ...(isSaved(d.id) ? { id: d.id } : {}),
    name: d.name.trim(),
    urlTemplate: d.urlTemplate.trim(),
    format: d.format,
    authHeader: d.authHeader.trim() || null,
    timeoutMs: Number(d.timeoutMs),
    cacheSeconds: Number(d.cacheSeconds),
  }));
}

/** Sources a field or the record can point at (saved ones only). */
export const mappableSources = (sources: DataSource[]) => sources.filter((s) => isSaved(s.id));

export interface RefDraft {
  sourceId: string;
  path: string;
}
export interface ItemsDraft extends RefDraft {
  idPath: string;
  titlePath: string;
}
export interface MappingDraft {
  name: RefDraft;
  email: RefDraft;
  items: ItemsDraft;
}

const refDraft = (ref: SourceRef | null): RefDraft => ({
  sourceId: ref?.sourceId ?? '',
  path: ref?.path ?? '',
});

export const mappingDraftOf = (m: RecordMapping): MappingDraft => ({
  name: refDraft(m.name),
  email: refDraft(m.email),
  items: {
    ...refDraft(m.items),
    idPath: m.items?.idPath ?? '',
    titlePath: m.items?.titlePath ?? '',
  },
});

/** Both parts empty = not mapped; anything else goes to the server, which checks it. */
const toRef = (d: RefDraft): SourceRef | null =>
  d.sourceId || d.path.trim() ? { sourceId: d.sourceId, path: d.path.trim() } : null;

export function toRecordMapping(d: MappingDraft): RecordMapping {
  const items = toRef(d.items);
  return {
    name: toRef(d.name),
    email: toRef(d.email),
    items: items
      ? { ...items, idPath: d.items.idPath.trim(), titlePath: d.items.titlePath.trim() || null }
      : null,
  };
}

/** "Profile → data.plan" for a mapped field, "Each item → sold" for a per-item one. */
export function fieldSourceLabel(
  sources: DataSource[],
  f: Pick<CustomerField, 'key' | 'sourceId' | 'path'>,
): string | null {
  if (!f.path) return null;
  if (f.key.includes('{id}')) return `Each item → ${f.path}`;
  const source = sources.find((s) => s.id === f.sourceId);
  return source ? `${source.name} → ${f.path}` : null;
}

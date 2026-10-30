import {
  API_KEY_PRESETS,
  API_KEY_SCOPES,
  presetOf,
  scopeLabel,
  type ApiKeyPreset,
  type ApiKeyScope,
} from '@bookleaf/shared';
import { toggleScope } from '../../lib/apiKeys';

const PRESETS: { id: Exclude<ApiKeyPreset, 'custom'>; label: string; hint: string }[] = [
  { id: 'read', label: 'Read only', hint: 'Read tickets and customers' },
  { id: 'write', label: 'Read & write', hint: 'Also raise and update tickets' },
];

const SCOPE_HINTS: Record<ApiKeyScope, string> = {
  'customers:read': 'One customer’s tickets, by your customer id',
  'tickets:read': 'List tickets and read conversations (never internal notes)',
  'tickets:write': 'Raise tickets, add customer messages, resolve, close or reopen',
};

interface Props {
  scopes: ApiKeyScope[];
  error?: string;
  onChange: (scopes: ApiKeyScope[]) => void;
}

const choiceClass =
  'flex cursor-pointer items-start gap-2.5 rounded-control border border-line bg-inset p-3 transition-colors hover:border-brand has-[:checked]:border-brand has-[:checked]:bg-brand-soft';

/** "What this key can do": a preset, or individual permissions (U-11). The server enforces them. */
export function ScopePicker({ scopes, error, onChange }: Props) {
  const preset = presetOf(scopes);
  const pick = (id: keyof typeof API_KEY_PRESETS) =>
    onChange([...API_KEY_PRESETS[id]].sort(byCatalogue));
  return (
    <fieldset
      className="flex min-w-0 flex-col gap-3"
      aria-describedby={error ? 'key-scopes-error' : undefined}
    >
      <legend className="mb-1.5 text-[12.5px] font-semibold text-ink-2">
        What this key can do
        {preset === 'custom' ? (
          <span className="ml-2 font-normal text-ink-3">Custom selection</span>
        ) : null}
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {PRESETS.map((p) => (
          <label key={p.id} className={choiceClass}>
            <input
              type="radio"
              name="key-preset"
              value={p.id}
              checked={preset === p.id}
              onChange={() => pick(p.id)}
              className="mt-0.5 h-4 w-4 accent-brand"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-ink">{p.label}</span>
              <span className="block text-[12px] text-ink-3">{p.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <ul className="flex flex-col gap-2" aria-label="Permissions">
        {API_KEY_SCOPES.map((s) => (
          <li key={s}>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                name="key-scopes"
                value={s}
                checked={scopes.includes(s)}
                onChange={(e) => onChange(toggleScope(scopes, s, e.target.checked))}
                className="mt-0.5 h-4 w-4 accent-brand"
              />
              <span className="min-w-0 text-[13px]">
                <span className="font-semibold text-ink">{scopeLabel(s)}</span>{' '}
                <code className="font-mono text-[11.5px] text-ink-3">{s}</code>
                <span className="block text-[12px] text-ink-3">{SCOPE_HINTS[s]}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {error ? (
        <p id="key-scopes-error" role="alert" className="text-[12px] text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

const byCatalogue = (a: ApiKeyScope, b: ApiKeyScope) =>
  API_KEY_SCOPES.indexOf(a) - API_KEY_SCOPES.indexOf(b);

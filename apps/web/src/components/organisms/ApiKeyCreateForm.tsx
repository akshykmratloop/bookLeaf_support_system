import { API_KEY_PRESETS, type ApiKeyScope, type CreateApiKeyRequest } from '@bookleaf/shared';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { Input } from '../atoms/Input';
import { ScopePicker } from '../molecules/ScopePicker';
import { KEY_NAME_MAX, newKeyErrors } from '../../lib/apiKeys';

interface Props {
  isPending: boolean;
  /** `onCreated` runs once the key exists, so the form can clear itself. */
  onCreate: (input: CreateApiKeyRequest, onCreated: () => void) => void;
}

const START: ApiKeyScope[] = [...API_KEY_PRESETS.read];

/**
 * Name and button on one aligned row, the hint under both; the button is always clearly enabled
 * and a missing name or permission is explained inline instead (U-8). Least privilege by default.
 */
export function ApiKeyCreateForm({ isPending, onCreate }: Props) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiKeyScope[]>(START);
  const [touched, setTouched] = useState(false);
  const errors = touched ? newKeyErrors(name, scopes) : {};
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(newKeyErrors(name, scopes)).length > 0) return;
    onCreate({ name: name.trim(), scopes }, () => {
      setName('');
      setScopes(START);
      setTouched(false);
    });
  };
  const described = errors.name ? 'key-name-error' : 'key-name-hint';
  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="key-name" className="text-[12.5px] font-semibold text-ink-2">
            New key name
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id="key-name"
              name="key-name"
              value={name}
              maxLength={KEY_NAME_MAX * 2}
              autoComplete="off"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={described}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 sm:h-10 sm:flex-1"
            />
            <Button type="submit" icon={<Plus size={15} aria-hidden />} isLoading={isPending}>
              Create key
            </Button>
          </div>
          {errors.name ? (
            <p id="key-name-error" role="alert" className="text-[12px] text-danger">
              {errors.name}
            </p>
          ) : (
            <p id="key-name-hint" className="text-[12px] text-ink-3">
              e.g. Production server, Staging. The key is shown once, right after you create it.
            </p>
          )}
        </div>
        <ScopePicker scopes={scopes} error={errors.scopes} onChange={setScopes} />
      </form>
    </Card>
  );
}

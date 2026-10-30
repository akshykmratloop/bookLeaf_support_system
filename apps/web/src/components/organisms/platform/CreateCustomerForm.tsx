import { CreateCustomerSchema, type CreateCustomer } from '@bookleaf/shared';
import { useState, type FormEvent } from 'react';
import { Button } from '../../atoms/Button';
import { Card } from '../../atoms/Card';
import { Input } from '../../atoms/Input';
import { Field } from '../../molecules/Field';
import { useToast } from '../../molecules/Toast';
import { errorMessage } from '../../../lib/api';
import { createCustomer, platformKeys } from '../../../lib/platform';
import { useApiMutation } from '../../../lib/queries';

type Values = Record<keyof CreateCustomer, string>;
const EMPTY: Values = { workspaceName: '', slug: '', ownerName: '', email: '', password: '' };

const FIELDS: { key: keyof CreateCustomer; label: string; type: string; hint?: string }[] = [
  { key: 'workspaceName', label: 'Business name', type: 'text' },
  {
    key: 'slug',
    label: 'Workspace address',
    type: 'text',
    hint: 'Lowercase letters, digits and dashes.',
  },
  { key: 'ownerName', label: 'Owner name', type: 'text' },
  { key: 'email', label: 'Owner email', type: 'email' },
  {
    key: 'password',
    label: 'Temporary password',
    type: 'password',
    hint: 'At least 12 characters, with a letter and a digit.',
  },
];

function issuesOf(values: Values): Partial<Values> {
  const parsed = CreateCustomerSchema.safeParse(values);
  if (parsed.success) return {};
  const out: Partial<Values> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof CreateCustomer;
    out[key] ??= issue.message;
  }
  return out;
}

/** Create a customer workspace with its first owner — the same rules as public sign-up. */
export function CreateCustomerForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Values>>({});
  const create = useApiMutation(createCustomer, [platformKeys.customers]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found = issuesOf(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    create.mutate(CreateCustomerSchema.parse(values), {
      onSuccess: () => {
        toast('success', `Created ${values.workspaceName}`);
        setValues(EMPTY);
        onDone();
      },
      onError: (err) => toast('error', errorMessage(err)),
    });
  };
  return (
    <Card className="p-5">
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-[15px] font-semibold sm:col-span-2">New customer</h2>
        {FIELDS.map((f) => (
          <Field
            key={f.key}
            id={`new-${f.key}`}
            label={f.label}
            hint={f.hint}
            error={errors[f.key]}
          >
            <Input
              id={`new-${f.key}`}
              type={f.type}
              autoComplete="off"
              value={values[f.key]}
              aria-invalid={Boolean(errors[f.key])}
              aria-describedby={
                errors[f.key] ? `new-${f.key}-error` : f.hint ? `new-${f.key}-hint` : undefined
              }
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </Field>
        ))}
        <div className="flex flex-wrap items-end justify-end gap-2 sm:col-span-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" isLoading={create.isPending}>
            Create customer
          </Button>
        </div>
      </form>
    </Card>
  );
}

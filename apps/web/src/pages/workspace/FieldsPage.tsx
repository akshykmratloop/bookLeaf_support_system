import type { CustomerField, CustomerFieldInput } from '@bookleaf/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { Pill } from '../../components/atoms/Pill';
import { PageHeader } from '../../components/molecules/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/molecules/States';
import { useToast } from '../../components/molecules/Toast';
import { CustomerFieldForm } from '../../components/organisms/CustomerFieldForm';
import { errorMessage, isApiError } from '../../lib/api';
import { useApiMutation } from '../../lib/queries';
import {
  createField,
  deleteField,
  updateField,
  useCustomerFields,
  workspaceKeys,
} from '../../lib/workspace';

type Editing = { kind: 'new' } | { kind: 'edit'; field: CustomerField } | null;

function FieldRow({
  f,
  onEdit,
  onDelete,
}: {
  f: CustomerField;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[13.5px] font-semibold">
          <code className="font-mono text-[12px]">{f.key}</code>
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
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" icon={<Pencil size={14} aria-hidden />} onClick={onEdit}>
          Edit
        </Button>
        <Button
          variant="danger"
          size="sm"
          icon={<Trash2 size={14} aria-hidden />}
          onClick={onDelete}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}

function FieldsEditor({ fields }: { fields: CustomerField[] }) {
  const toast = useToast();
  const [editing, setEditing] = useState<Editing>(null);
  const save = useApiMutation(
    (v: { id: string | null; input: CustomerFieldInput }) =>
      v.id ? updateField(v.id, v.input) : createField(v.input),
    [workspaceKeys.fields],
  );
  const remove = useApiMutation(deleteField, [workspaceKeys.fields]);
  const fieldError = (p: string) => (isApiError(save.error) ? save.error.fieldError(p) : undefined);
  const onSubmit = (input: CustomerFieldInput) =>
    save.mutate(
      { id: editing?.kind === 'edit' ? editing.field.id : null, input },
      {
        onSuccess: () => {
          toast('success', 'Field saved');
          setEditing(null);
        },
        onError: (e) => toast('error', errorMessage(e)),
      },
    );
  const onDelete = (f: CustomerField) => {
    if (!window.confirm(`Remove the field ${f.key}?`)) return;
    remove.mutate(f.id, { onError: (e) => toast('error', errorMessage(e)) });
  };
  return (
    <div className="grid max-w-[960px] gap-4">
      {editing ? (
        <Card className="p-5">
          <CustomerFieldForm
            key={editing.kind === 'edit' ? editing.field.id : 'new'}
            initial={editing.kind === 'edit' ? editing.field : null}
            isSaving={save.isPending}
            fieldError={fieldError}
            onSubmit={onSubmit}
            onCancel={() => setEditing(null)}
          />
        </Card>
      ) : (
        <div>
          <Button icon={<Plus size={15} aria-hidden />} onClick={() => setEditing({ kind: 'new' })}>
            Add field
          </Button>
        </div>
      )}
      <Card className="p-0">
        {fields.length === 0 ? (
          <EmptyState
            title="No fields yet"
            body="Describe the facts your product sends about each customer: balances, dates, statuses. The assistant only states what these fields contain."
          />
        ) : (
          <ul>
            {fields.map((f) => (
              <FieldRow
                key={f.id}
                f={f}
                onEdit={() => setEditing({ kind: 'edit', field: f })}
                onDelete={() => onDelete(f)}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function FieldsPage() {
  const fields = useCustomerFields();
  return (
    <>
      <PageHeader
        title="Customer data"
        subtitle="The fields your product sends about each customer. The assistant answers only from these."
      />
      {fields.isPending ? <LoadingState /> : null}
      {fields.isError ? (
        <ErrorState message={errorMessage(fields.error)} onRetry={() => void fields.refetch()} />
      ) : null}
      {fields.data ? <FieldsEditor fields={fields.data} /> : null}
    </>
  );
}

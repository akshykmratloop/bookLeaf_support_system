import type { CustomerField, CustomerFieldInput, DataSource } from '@bookleaf/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { CustomerFieldRow } from '../../components/molecules/CustomerFieldRow';
import { PageHeader } from '../../components/molecules/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/molecules/States';
import { useToast } from '../../components/molecules/Toast';
import { CustomerFieldForm } from '../../components/organisms/CustomerFieldForm';
import { CustomerRecordSection } from '../../components/organisms/CustomerRecordSection';
import { errorMessage, isApiError } from '../../lib/api';
import { fieldSourceLabel, mappableSources } from '../../lib/dataSources';
import { useApiMutation } from '../../lib/queries';
import {
  createField,
  deleteField,
  updateField,
  useConnector,
  useCustomerFields,
  workspaceKeys,
} from '../../lib/workspace';

type Editing = { kind: 'new' } | { kind: 'edit'; field: CustomerField } | null;

function FieldsEditor({ fields, sources }: { fields: CustomerField[]; sources: DataSource[] }) {
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
            sources={mappableSources(sources)}
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
              <CustomerFieldRow
                key={f.id}
                f={f}
                mappedFrom={fieldSourceLabel(sources, f)}
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
  const connector = useConnector();
  return (
    <>
      <PageHeader
        title="Customer data"
        subtitle="The fields your product sends about each customer, and where each one is read. The assistant answers only from these."
      />
      {fields.isPending ? <LoadingState /> : null}
      {fields.isError ? (
        <ErrorState error={fields.error} onRetry={() => void fields.refetch()} />
      ) : null}
      {fields.data ? (
        <FieldsEditor fields={fields.data} sources={connector.data?.sources ?? []} />
      ) : null}
      {connector.data ? (
        <div className="mt-4 max-w-[960px]">
          <CustomerRecordSection connector={connector.data} />
        </div>
      ) : null}
    </>
  );
}

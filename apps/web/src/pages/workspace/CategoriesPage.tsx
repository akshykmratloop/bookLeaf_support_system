import { PRIORITY_LABELS, type Category, type CreateCategory } from '@bookleaf/shared';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { Pill } from '../../components/atoms/Pill';
import { PageHeader } from '../../components/molecules/PageHeader';
import { ReorderButtons } from '../../components/molecules/ReorderButtons';
import { ErrorState, LoadingState } from '../../components/molecules/States';
import { useToast } from '../../components/molecules/Toast';
import { CategoryForm } from '../../components/organisms/CategoryForm';
import { errorMessage, isApiError } from '../../lib/api';
import {
  categoryKeys,
  createCategory,
  moved,
  reorderCategories,
  updateCategory,
  useCategories,
} from '../../lib/categories';
import { useApiMutation } from '../../lib/queries';

type Editing = { kind: 'new' } | { kind: 'edit'; category: Category } | null;
const INVALIDATE = [categoryKeys.all, categoryKeys.options];

interface RowProps {
  c: Category;
  index: number;
  count: number;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onMove: (by: -1 | 1) => void;
}

function CategoryRow({ c, index, count, busy, onEdit, onToggle, onMove }: RowProps) {
  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <ReorderButtons
        name={c.label}
        isFirst={index === 0}
        isLast={index === count - 1}
        disabled={busy}
        onMove={onMove}
      />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">
          {c.label}
          <code className="font-mono text-[11.5px] text-ink-3">{c.key}</code>
          <Pill>{PRIORITY_LABELS[c.defaultPriority]}</Pill>
          {c.slaHours ? <Pill tone="info">{c.slaHours} h reply</Pill> : null}
          {c.isActive ? null : <Pill tone="warning">inactive</Pill>}
        </p>
        <p className="text-[12.5px] text-ink-2">{c.description}</p>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" icon={<Pencil size={14} aria-hidden />} onClick={onEdit}>
          Edit
        </Button>
        <Button
          variant={c.isActive ? 'danger' : 'soft'}
          size="sm"
          disabled={busy}
          onClick={onToggle}
        >
          {c.isActive ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </li>
  );
}

function CategoriesEditor({ categories }: { categories: Category[] }) {
  const toast = useToast();
  const [editing, setEditing] = useState<Editing>(null);
  const save = useApiMutation(({ id, input }: { id: string | null; input: CreateCategory }) => {
    if (!id) return createCategory(input);
    const { key: _key, ...change } = input;
    return updateCategory(id, change);
  }, INVALIDATE);
  const toggle = useApiMutation(
    (c: Category) => updateCategory(c.id, { isActive: !c.isActive }),
    INVALIDATE,
  );
  const reorder = useApiMutation(reorderCategories, INVALIDATE);
  const onError = (e: unknown) => toast('error', errorMessage(e));
  const fieldError = (p: string) => (isApiError(save.error) ? save.error.fieldError(p) : undefined);
  const onSubmit = (input: CreateCategory) =>
    save.mutate(
      { id: editing?.kind === 'edit' ? editing.category.id : null, input },
      {
        onSuccess: () => {
          toast('success', 'Category saved');
          setEditing(null);
        },
        onError,
      },
    );
  const move = (index: number, by: -1 | 1) =>
    reorder.mutate(
      moved(categories, index, by).map((c) => c.id),
      { onError },
    );
  return (
    <div className="grid max-w-[960px] gap-4">
      {editing ? (
        <Card className="p-5">
          <CategoryForm
            key={editing.kind === 'edit' ? editing.category.id : 'new'}
            initial={editing.kind === 'edit' ? editing.category : null}
            isSaving={save.isPending}
            fieldError={fieldError}
            onSubmit={onSubmit}
            onCancel={() => setEditing(null)}
          />
        </Card>
      ) : (
        <div>
          <Button icon={<Plus size={15} aria-hidden />} onClick={() => setEditing({ kind: 'new' })}>
            Add category
          </Button>
        </div>
      )}
      <Card className="p-0">
        <ul>
          {categories.map((c, i) => (
            <CategoryRow
              key={c.id}
              c={c}
              index={i}
              count={categories.length}
              busy={reorder.isPending || toggle.isPending}
              onEdit={() => setEditing({ kind: 'edit', category: c })}
              onToggle={() => toggle.mutate(c, { onError })}
              onMove={(by) => move(i, by)}
            />
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function CategoriesPage() {
  const categories = useCategories();
  return (
    <>
      <PageHeader
        title="Ticket categories"
        subtitle="How your tickets are sorted. The AI triage reads each description; the order is the order everyone sees."
      />
      {categories.isPending ? <LoadingState /> : null}
      {categories.isError ? (
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      ) : null}
      {categories.data ? <CategoriesEditor categories={categories.data} /> : null}
    </>
  );
}

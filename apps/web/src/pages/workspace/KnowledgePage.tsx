import type { Article, Category, CreateArticle } from '@bookleaf/shared';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { Pill } from '../../components/atoms/Pill';
import { PageHeader } from '../../components/molecules/PageHeader';
import { ReorderButtons } from '../../components/molecules/ReorderButtons';
import { EmptyState, ErrorState, LoadingState } from '../../components/molecules/States';
import { useToast } from '../../components/molecules/Toast';
import { ArticleForm } from '../../components/organisms/ArticleForm';
import { errorMessage, isApiError } from '../../lib/api';
import {
  categoryKeys,
  createArticle,
  labelFor,
  moved,
  reorderArticles,
  updateArticle,
  useArticles,
  useCategories,
} from '../../lib/categories';
import { useApiMutation } from '../../lib/queries';

type Editing = { kind: 'new' } | { kind: 'edit'; article: Article } | null;
const INVALIDATE = [categoryKeys.articles];

interface RowProps {
  a: Article;
  categories: Category[];
  index: number;
  count: number;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onMove: (by: -1 | 1) => void;
}

function ArticleRow({ a, categories, index, count, busy, onEdit, onToggle, onMove }: RowProps) {
  const linked = a.categoryKeys.map((k) => labelFor(categories, k));
  return (
    <li className="flex flex-wrap items-start gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <ReorderButtons
        name={a.title}
        isFirst={index === 0}
        isLast={index === count - 1}
        disabled={busy}
        onMove={onMove}
      />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">
          {a.title}
          {a.isActive ? null : <Pill tone="warning">inactive</Pill>}
        </p>
        <p className="line-clamp-2 whitespace-pre-line text-[12.5px] text-ink-2">{a.body}</p>
        <p className="mt-1 text-[11.5px] text-ink-3">
          {linked.length ? `Drafts for: ${linked.join(' · ')}` : 'Assistant only (no category)'}
        </p>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" icon={<Pencil size={14} aria-hidden />} onClick={onEdit}>
          Edit
        </Button>
        <Button
          variant={a.isActive ? 'danger' : 'soft'}
          size="sm"
          disabled={busy}
          onClick={onToggle}
        >
          {a.isActive ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </li>
  );
}

function KnowledgeEditor({
  articles,
  categories,
}: {
  articles: Article[];
  categories: Category[];
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<Editing>(null);
  const save = useApiMutation(
    ({ id, input }: { id: string | null; input: CreateArticle }) =>
      id ? updateArticle(id, input) : createArticle(input),
    INVALIDATE,
  );
  const toggle = useApiMutation(
    (a: Article) => updateArticle(a.id, { isActive: !a.isActive }),
    INVALIDATE,
  );
  const reorder = useApiMutation(reorderArticles, INVALIDATE);
  const onError = (e: unknown) => toast('error', errorMessage(e));
  const fieldError = (p: string) => (isApiError(save.error) ? save.error.fieldError(p) : undefined);
  const onSubmit = (input: CreateArticle) =>
    save.mutate(
      { id: editing?.kind === 'edit' ? editing.article.id : null, input },
      {
        onSuccess: () => {
          toast('success', 'Article saved');
          setEditing(null);
        },
        onError,
      },
    );
  return (
    <div className="grid max-w-[960px] gap-4">
      {editing ? (
        <Card className="p-5">
          <ArticleForm
            key={editing.kind === 'edit' ? editing.article.id : 'new'}
            initial={editing.kind === 'edit' ? editing.article : null}
            categories={categories}
            isSaving={save.isPending}
            fieldError={fieldError}
            onSubmit={onSubmit}
            onCancel={() => setEditing(null)}
          />
        </Card>
      ) : (
        <div>
          <Button icon={<Plus size={15} aria-hidden />} onClick={() => setEditing({ kind: 'new' })}>
            Add article
          </Button>
        </div>
      )}
      <Card className="p-0">
        {articles.length === 0 ? (
          <EmptyState
            title="No articles yet"
            body="Write down your policies, prices and timelines. AI reply drafts use only the articles linked to the ticket's category."
          />
        ) : (
          <ul>
            {articles.map((a, i) => (
              <ArticleRow
                key={a.id}
                a={a}
                categories={categories}
                index={i}
                count={articles.length}
                busy={reorder.isPending || toggle.isPending}
                onEdit={() => setEditing({ kind: 'edit', article: a })}
                onToggle={() => toggle.mutate(a, { onError })}
                onMove={(by) =>
                  reorder.mutate(
                    moved(articles, i, by).map((x) => x.id),
                    { onError },
                  )
                }
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function KnowledgePage() {
  const articles = useArticles();
  const categories = useCategories();
  const failed = articles.error ?? categories.error;
  return (
    <>
      <PageHeader
        title="Knowledge base"
        subtitle="The policy your AI may use. Reply drafts get only the articles linked to the ticket's category; the author assistant reads every active article."
      />
      {articles.isPending || categories.isPending ? <LoadingState /> : null}
      {failed ? (
        <ErrorState
          error={failed}
          onRetry={() => void Promise.all([articles.refetch(), categories.refetch()])}
        />
      ) : null}
      {articles.data && categories.data ? (
        <KnowledgeEditor articles={articles.data} categories={categories.data} />
      ) : null}
    </>
  );
}

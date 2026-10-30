import { ARTICLE_LIMITS, type Article, type Category, type CreateArticle } from '@bookleaf/shared';
import { useState, type FormEvent } from 'react';
import { Button } from '../atoms/Button';
import { Input, Textarea } from '../atoms/Input';
import { CheckboxField } from '../molecules/CheckboxField';
import { Field } from '../molecules/Field';

const EMPTY: CreateArticle = { title: '', body: '', categoryKeys: [], isActive: true };

const draftOf = (a: Article): CreateArticle => ({
  title: a.title,
  body: a.body,
  categoryKeys: [...a.categoryKeys],
  isActive: a.isActive,
});

interface Props {
  initial: Article | null;
  categories: Category[];
  isSaving: boolean;
  fieldError: (path: string) => string | undefined;
  onSubmit: (input: CreateArticle) => void;
  onCancel: () => void;
}

/** The categories whose tickets get this article in their AI reply drafts. */
function CategoryLinks({
  categories,
  chosen,
  error,
  onToggle,
}: {
  categories: Category[];
  chosen: readonly string[];
  error: string | undefined;
  onToggle: (key: string, on: boolean) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-[12.5px] font-semibold">
        Used in AI reply drafts for these categories
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {categories.map((c) => (
          <CheckboxField
            key={c.key}
            id={`article-category-${c.key}`}
            name="categoryKeys"
            checked={chosen.includes(c.key)}
            label={c.isActive ? c.label : `${c.label} (inactive)`}
            onChange={(on) => onToggle(c.key, on)}
          />
        ))}
      </div>
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
    </fieldset>
  );
}

/** Add or edit one knowledge-base article: the policy text the AI may quote. */
export function ArticleForm({
  initial,
  categories,
  isSaving,
  fieldError,
  onSubmit,
  onCancel,
}: Props) {
  const [d, setD] = useState<CreateArticle>(() => (initial ? draftOf(initial) : EMPTY));
  const set = (patch: Partial<CreateArticle>) => setD((prev) => ({ ...prev, ...patch }));
  const keys = d.categoryKeys ?? [];
  const toggle = (key: string, on: boolean) =>
    set({ categoryKeys: on ? [...keys, key] : keys.filter((k) => k !== key) });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(d);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field id="article-title" label="Title" error={fieldError('title')}>
        <Input
          id="article-title"
          name="title"
          maxLength={ARTICLE_LIMITS.title}
          value={d.title}
          onChange={(e) => set({ title: e.target.value })}
        />
      </Field>
      <Field
        id="article-body"
        label="Text (plain text; the AI copies figures and timelines exactly as written)"
        counter={`${d.body.length}/${ARTICLE_LIMITS.body}`}
        error={fieldError('body')}
      >
        <Textarea
          id="article-body"
          name="body"
          rows={8}
          maxLength={ARTICLE_LIMITS.body}
          value={d.body}
          onChange={(e) => set({ body: e.target.value })}
        />
      </Field>
      <CategoryLinks
        categories={categories}
        chosen={keys}
        error={fieldError('categoryKeys')}
        onToggle={toggle}
      />
      <CheckboxField
        id="article-active"
        name="isActive"
        checked={d.isActive ?? true}
        label="Active (the AI may use it)"
        onChange={(isActive) => set({ isActive })}
      />
      <div className="flex gap-2">
        <Button type="submit" isLoading={isSaving}>
          {initial ? 'Save article' : 'Add article'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

import type { TicketDraft } from '@bookleaf/shared';
import { labelFor, useCategoryOptions } from '../../lib/categories';
import { Link } from 'react-router';
import { Card } from '../atoms/Card';
import { Pill } from '../atoms/Pill';
import { useAuthorPaths } from '../../lib/paths';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-[13px] wrap-anywhere whitespace-pre-wrap">{value || '—'}</dd>
    </div>
  );
}

/** The ticket a past conversation prepared, read-only. */
export function DraftSummary({ draft }: { draft: TicketDraft }) {
  const authorPaths = useAuthorPaths();
  const sent = draft.ticket;
  const categories = useCategoryOptions().data;
  return (
    <Card
      className="flex flex-col gap-3 p-4"
      role="region"
      aria-label="Ticket from this conversation"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] font-semibold">Ticket</p>
        {sent ? (
          <Link className="text-[12.5px] font-semibold underline" to={authorPaths.ticket(sent.id)}>
            {sent.number}
          </Link>
        ) : (
          <Pill tone="warning">Not sent</Pill>
        )}
      </div>
      <dl className="flex flex-col gap-3">
        <Field label="Issue type" value={labelFor(categories, draft.category)} />
        <Field label="Subject" value={draft.subject} />
        <Field label="Description" value={draft.description} />
      </dl>
    </Card>
  );
}

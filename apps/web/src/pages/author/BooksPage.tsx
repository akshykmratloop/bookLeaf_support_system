import { PlusCircle } from 'lucide-react';
import { Link } from 'react-router';
import { Card } from '../../components/atoms/Card';
import { PageHeader } from '../../components/molecules/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/molecules/States';
import { BooksTable } from '../../components/organisms/BooksTable';
import { errorMessage } from '../../lib/api';
import { money } from '../../lib/format';
import { useBooks } from '../../lib/queries';

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{label}</p>
      <p className="mt-1 font-mono text-[20px] font-semibold">{value}</p>
      {note ? <p className="mt-1 text-[12px] text-ink-3">{note}</p> : null}
    </Card>
  );
}

export function BooksPage() {
  const books = useBooks();
  const items = books.data ?? [];
  const sum = (f: (b: (typeof items)[number]) => number) => items.reduce((s, b) => s + f(b), 0);
  return (
    <>
      <PageHeader
        title="My Books"
        subtitle="Sales and royalties for every book you publish with BookLeaf."
        actions={
          <Link to="/tickets/new" className="inline-flex h-9 items-center gap-2 rounded-[9px] bg-brand-strong px-4 text-[12.5px] font-semibold text-white hover:bg-brand">
            <PlusCircle size={15} aria-hidden /> Ask a question
          </Link>
        }
      />
      {books.isPending ? <LoadingState label="Loading your books…" /> : null}
      {books.isError ? <ErrorState message={errorMessage(books.error)} onRetry={() => void books.refetch()} /> : null}
      {books.data && items.length === 0 ? <EmptyState title="No books yet" body="Books you publish with BookLeaf will appear here." /> : null}
      {items.length > 0 ? (
        <>
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Royalty earned" value={money(sum((b) => b.royaltyEarnedPaise))} note={`${items.length} book${items.length === 1 ? '' : 's'}`} />
            <Stat label="Royalty paid" value={money(sum((b) => b.royaltyPaidPaise))} />
            <Stat
              label="Royalty pending"
              value={money(sum((b) => b.royaltyPendingPaise))}
              note="Paid quarterly within 45 days of quarter end, once your total pending reaches ₹1,000."
            />
          </div>
          <Card>
            <BooksTable books={items} />
          </Card>
        </>
      ) : null}
    </>
  );
}

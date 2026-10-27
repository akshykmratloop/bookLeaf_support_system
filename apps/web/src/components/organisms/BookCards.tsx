import type { Book } from '@bookleaf/shared';
import { Card } from '../atoms/Card';

/** Each book with the details BookLeaf shows for it (status, sales, royalties…). */
export function BookCards({ books }: { books: Book[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {books.map((b) => (
        <li key={b.id}>
          <Card className="p-4">
            <h2 className="text-[15px] font-semibold">{b.title}</h2>
            {b.details.length === 0 ? (
              <p className="mt-1 text-[12.5px] text-ink-3">Details are not available right now.</p>
            ) : (
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
                {b.details.map((d) => (
                  <div key={d.label}>
                    <dt className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
                      {d.label}
                    </dt>
                    <dd className="mt-0.5 text-[13px]">{d.display}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}

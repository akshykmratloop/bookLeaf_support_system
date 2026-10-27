import { STAGE_LABELS, type Book } from '@bookleaf/shared';
import { Pill } from '../atoms/Pill';
import { day, money } from '../../lib/format';

const th =
  'px-4 py-3 text-left text-[11px] font-semibold tracking-wide text-ink-3 uppercase whitespace-nowrap';
const td = 'px-4 py-3 align-top whitespace-nowrap';

function StageCell({ book }: { book: Book }) {
  const live = book.stage === 'PUBLISHED_LIVE';
  return (
    <Pill tone={live ? 'success' : 'warning'} dot>
      {live ? 'Published' : `In production · ${STAGE_LABELS[book.stage]}`}
    </Pill>
  );
}

/** The ten fields the brief asks for. Unknown values say so instead of showing ₹0. */
export function BooksTable({ books }: { books: Book[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead className="border-b border-line">
          <tr>
            <th className={th}>Title</th>
            <th className={th}>ISBN</th>
            <th className={th}>Genre</th>
            <th className={th}>Published</th>
            <th className={th}>Status</th>
            <th className={`${th} text-right`}>MRP</th>
            <th className={`${th} text-right`}>Copies sold</th>
            <th className={`${th} text-right`}>Royalty earned</th>
            <th className={`${th} text-right`}>Paid</th>
            <th className={`${th} text-right`}>Pending</th>
          </tr>
        </thead>
        <tbody>
          {books.map((b) => (
            <tr key={b.id} className="border-b border-line last:border-0">
              <td className={`${td} font-semibold whitespace-normal`}>
                {b.title}
                <span className="block text-[11.5px] font-normal text-ink-3">
                  Last payout:{' '}
                  {day(b.lastPayoutDate, b.stage === 'PUBLISHED_LIVE' ? 'None yet' : '—')}
                </span>
              </td>
              <td className={`${td} font-mono text-[12px] text-ink-2`}>{b.isbn}</td>
              <td className={td}>{b.genre}</td>
              <td className={td}>{day(b.publicationDate, 'Not yet')}</td>
              <td className={td}>
                <StageCell book={b} />
              </td>
              <td className={`${td} text-right`}>{money(b.mrpPaise, 'Set at publication')}</td>
              <td className={`${td} text-right font-mono`}>
                {b.copiesSold.toLocaleString('en-IN')}
              </td>
              <td className={`${td} text-right font-mono`}>{money(b.royaltyEarnedPaise)}</td>
              <td className={`${td} text-right font-mono`}>{money(b.royaltyPaidPaise)}</td>
              <td
                className={`${td} text-right font-mono font-semibold ${b.royaltyPendingPaise > 0 ? 'text-accent' : 'text-ink-3'}`}
              >
                {money(b.royaltyPendingPaise)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

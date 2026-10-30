import type { CustomerItem } from '@bookleaf/shared';
import { ChevronRight } from 'lucide-react';
import { orderedItems } from '../../lib/ticketCustomer';
import { Pill } from '../atoms/Pill';
import { CustomerLines } from './CustomerLines';

/**
 * The customer's items (for BookLeaf: books), each folding open to its lines. The item the
 * ticket is about comes first and starts open.
 */
export function CustomerItemList({ items }: { items: readonly CustomerItem[] }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {orderedItems(items).map((item) => (
        <li key={item.externalId}>
          <details open={item.isTicketItem} className="group rounded-control bg-panel-2">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-control px-2.5 py-2 text-[12.5px] font-semibold focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              <ChevronRight
                size={14}
                aria-hidden
                className="shrink-0 text-ink-3 transition-transform group-open:rotate-90"
              />
              <span className="min-w-0 flex-1 break-words">{item.title}</span>
              {item.isTicketItem ? <Pill tone="brand">This ticket</Pill> : null}
            </summary>
            <div className="px-2.5 pt-1 pb-2.5">
              {item.lines.length ? (
                <CustomerLines lines={item.lines} />
              ) : (
                <p className="text-[12px] text-ink-3">No details from the product right now.</p>
              )}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

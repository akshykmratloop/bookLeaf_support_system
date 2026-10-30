import type { TicketSource } from '@bookleaf/shared';
import {
  BookOpenCheck,
  Headphones,
  MessageCircle,
  MessagesSquare,
  Printer,
  ScanBarcode,
  Store,
  Tag,
  Ticket,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

interface Look {
  label: string;
  colors: string;
  Icon: LucideIcon;
}

type Style = Omit<Look, 'label'>;

/** BookLeaf's original categories keep their own colour and icon. */
const KNOWN: Readonly<Record<string, Style>> = {
  ROYALTY_PAYMENTS: { colors: 'bg-cat-royalty-bg text-cat-royalty', Icon: Wallet },
  ISBN_METADATA: { colors: 'bg-cat-isbn-bg text-cat-isbn', Icon: ScanBarcode },
  PRINTING_QUALITY: { colors: 'bg-cat-printing-bg text-cat-printing', Icon: Printer },
  DISTRIBUTION_AVAILABILITY: {
    colors: 'bg-cat-distribution-bg text-cat-distribution',
    Icon: Store,
  },
  BOOK_STATUS_PRODUCTION: {
    colors: 'bg-cat-production-bg text-cat-production',
    Icon: BookOpenCheck,
  },
  GENERAL_INQUIRY: { colors: 'bg-cat-general-bg text-cat-general', Icon: MessageCircle },
};

const GENERAL: Style = { colors: 'bg-cat-general-bg text-cat-general', Icon: MessageCircle };
const PALETTE = [
  'bg-cat-royalty-bg text-cat-royalty',
  'bg-cat-isbn-bg text-cat-isbn',
  'bg-cat-printing-bg text-cat-printing',
  'bg-cat-distribution-bg text-cat-distribution',
  'bg-cat-production-bg text-cat-production',
  'bg-cat-general-bg text-cat-general',
] as const;

/** Any other workspace category: a stable colour picked from its key. */
function styleOf(key: string): Style {
  const known = KNOWN[key];
  if (known) return known;
  const hash = [...key].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return { colors: PALETTE[hash % PALETTE.length] ?? GENERAL.colors, Icon: Tag };
}

/**
 * Colour, icon and label of a workspace category (label from the ticket, else its key); a ticket
 * not classified yet looks "general".
 */
export function categoryStyle(category: string | null, label?: string | null): Look {
  if (!category) return { label: 'Not sorted yet', ...GENERAL };
  return { label: label || category, ...styleOf(category) };
}

const CHANNEL: Record<TicketSource, { label: string; Icon: LucideIcon }> = {
  PORTAL: { label: 'Ticket form', Icon: Ticket },
  CHAT: { label: 'Chat', Icon: MessagesSquare },
  VOICE: { label: 'Call', Icon: Headphones },
};

export const channelStyle = (channel: TicketSource) => CHANNEL[channel];

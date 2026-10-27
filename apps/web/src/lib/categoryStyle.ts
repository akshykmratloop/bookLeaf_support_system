import { CATEGORY_LABELS, type TicketCategory, type TicketSource } from '@bookleaf/shared';
import {
  BookOpenCheck,
  Headphones,
  MessageCircle,
  MessagesSquare,
  Printer,
  ScanBarcode,
  Store,
  Ticket,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

interface Look {
  label: string;
  colors: string;
  Icon: LucideIcon;
}

const CATEGORY: Record<TicketCategory, Omit<Look, 'label'>> = {
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

/** Colour, icon and label of an issue type; a ticket not classified yet looks "general". */
export function categoryStyle(category: TicketCategory | null): Look {
  if (!category) return { label: 'Not sorted yet', ...CATEGORY.GENERAL_INQUIRY };
  return { label: CATEGORY_LABELS[category], ...CATEGORY[category] };
}

const CHANNEL: Record<TicketSource, { label: string; Icon: LucideIcon }> = {
  PORTAL: { label: 'Ticket form', Icon: Ticket },
  CHAT: { label: 'Chat', Icon: MessagesSquare },
  VOICE: { label: 'Call', Icon: Headphones },
};

export const channelStyle = (channel: TicketSource) => CHANNEL[channel];

import { describe, expect, it } from 'vitest';

/**
 * U-5: the author widget scrolls vertically only. A CSS grid with no column template at its
 * smallest size gets an `auto` column that grows to the widest card's content (a long subject
 * or book title), which pushes cards and badges past the panel. Every widget grid therefore
 * starts from `grid-cols-1` (`minmax(0, 1fr)`), and the shell's scroll area hides x-overflow.
 */
const SOURCES = import.meta.glob<string>(
  [
    '../pages/author/**/*.tsx',
    '../pages/embed/**/*.tsx',
    '../components/templates/Embed*.tsx',
    '../components/molecules/TicketCard*.tsx',
    '../components/molecules/ConversationRow.tsx',
    '../components/molecules/QuickAction.tsx',
    '../components/atoms/Chip.tsx',
    '../components/atoms/Tabs.tsx',
    '../components/molecules/StatusStepper.tsx',
    '../components/molecules/ChatBubble.tsx',
    '../components/molecules/QueuedBubble.tsx',
    '../components/organisms/TicketConversation.tsx',
    '../components/molecules/DraftSummary.tsx',
    '../components/molecules/TranscriptList.tsx',
    '../components/molecules/SectionHeader.tsx',
    '../components/organisms/AskHeader.tsx',
    '../components/organisms/ChatCallBar.tsx',
    '../components/organisms/ChatPanel.tsx',
    '../components/organisms/DraftSheet.tsx',
    '../components/organisms/HomeGreeting.tsx',
    '../components/organisms/SolveTicketCard.tsx',
    '../components/organisms/TicketDraftPanel.tsx',
    '../components/organisms/TicketForm.tsx',
    '../components/organisms/TicketInfoCard.tsx',
    '../components/organisms/TicketReplyBox.tsx',
    '../components/organisms/VoiceCallPanel.tsx',
    '../components/molecules/DraftFields.tsx',
  ],
  { query: '?raw', import: 'default', eager: true },
);

const source = (suffix: string) => {
  const entry = Object.entries(SOURCES).find(([path]) => path.endsWith(suffix));
  if (!entry) throw new Error(`${suffix} is not in the widget sources`);
  return entry[1];
};

const classNames = (text: string) =>
  [...text.matchAll(/className="([^"]*)"/g)].map((m) => (m[1] ?? '').split(/\s+/));

/**
 * A layout `grid` without a base (unprefixed) `grid-cols-*`. Centring wrappers
 * (`grid place-items-center`, one small item such as a badge or a message) are fine.
 */
const hasLooseGrid = (classes: string[]) =>
  classes.includes('grid') &&
  !classes.includes('place-items-center') &&
  !classes.some((c) => c.startsWith('grid-cols-'));

/** `overflow-auto` / `overflow-x-auto` / `…-scroll` would add a scrollbar sideways. */
const SCROLLER = /^overflow-(x-)?(auto|scroll)$/;
const hasSidewaysScroller = (classes: string[]) => classes.some((name) => SCROLLER.test(name));

describe('author widget layout', () => {
  it('reads the widget pages', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(8);
  });

  it('gives every grid a column template that can shrink below its content', () => {
    const loose = Object.entries(SOURCES).flatMap(([path, text]) =>
      classNames(text)
        .filter(hasLooseGrid)
        .map((classes) => `${path}: ${classes.join(' ')}`),
    );
    expect(loose).toEqual([]);
  });

  it('wraps a long unbroken word in message text instead of cutting it off', () => {
    const unwrapped = Object.entries(SOURCES).flatMap(([path, text]) =>
      classNames(text)
        .filter((c) => c.includes('whitespace-pre-wrap') && !c.includes('wrap-anywhere'))
        .map((classes) => `${path}: ${classes.join(' ')}`),
    );
    expect(unwrapped).toEqual([]);
  });

  it('never scrolls sideways in the widget content area', () => {
    const main = classNames(source('EmbedShell.tsx')).find((c) => c.includes('overflow-y-auto'));
    expect(main).toContain('overflow-x-hidden');
  });

  it('adds no sideways scroller of its own (the ticket tabs wrap instead)', () => {
    const scrollers = Object.entries(SOURCES).flatMap(([path, text]) =>
      classNames(text)
        .filter(hasSidewaysScroller)
        .map((classes) => `${path}: ${classes.join(' ')}`),
    );
    expect(scrollers).toEqual([]);
  });

  it('lets a ticket card shrink and its chips truncate instead of overflowing', () => {
    const [card] = classNames(source('TicketCard.tsx'));
    expect(card).toContain('min-w-0');
    const chip = source('Chip.tsx');
    expect(chip).toContain('max-w-full');
    expect(chip).toContain('truncate');
  });
});

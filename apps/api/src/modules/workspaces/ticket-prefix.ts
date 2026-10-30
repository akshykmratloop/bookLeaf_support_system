import type { Prisma } from '@prisma/client';

/**
 * A workspace's ticket prefix (F-13): BL in BL-1001. Made once at signup from the company name and
 * never changed. Unique across the platform, so every full label is platform-unique. The migration
 * `20261030110000_ticket_numbers_per_workspace` gave existing workspaces prefixes by the same rule.
 */
export const PREFIX_FALLBACK = 'TKT';
const MIN_LETTERS = 2;
const MAX_LETTERS = 5;

/** The capitals of a one-word name (BookLeaf → BL), else its first two letters (acme → AC). */
function oneWordLetters(word: string): string {
  const capitals = word.replace(/[^A-Z]/g, '');
  return capitals.length >= MIN_LETTERS ? capitals : word.slice(0, MIN_LETTERS);
}

/** Initials of a multi-word name (Acme Corp → AC), 2–5 uppercase letters, else TKT. */
export function prefixBase(name: string): string {
  const plain = name.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const words = plain.match(/[A-Za-z]+/g) ?? [];
  const letters =
    words.length > 1 ? words.map((w) => w.charAt(0)).join('') : oneWordLetters(words[0] ?? '');
  const base = letters.toUpperCase().slice(0, MAX_LETTERS);
  return base.length >= MIN_LETTERS ? base : PREFIX_FALLBACK;
}

/** The base if free, else the first free numbered one: BL → BL2 → BL3 … */
export function firstFreePrefix(base: string, taken: readonly string[]): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}${n}`)) n += 1;
  return `${base}${n}`;
}

/**
 * The first free prefix for a new workspace's name. A concurrent signup can still take it before
 * this transaction commits; the unique index then refuses the insert and signup retries.
 */
export async function freePrefixFor(tx: Prisma.TransactionClient, name: string): Promise<string> {
  const base = prefixBase(name);
  const rows = await tx.workspace.findMany({
    where: { ticketPrefix: { startsWith: base } },
    select: { ticketPrefix: true },
  });
  return firstFreePrefix(
    base,
    rows.map((r) => r.ticketPrefix),
  );
}

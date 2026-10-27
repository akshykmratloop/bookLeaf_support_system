import { describe, expect, it } from 'vitest';
import { sampleCustomer } from '../../../test/fixtures/host.js';
import { factsFor } from '../../host/facts.js';
import { canOverride, checkReply } from './check.js';
import { findDates, findDurations, findMoney } from './extract.js';

const facts = factsFor(sampleCustomer('AUTH001'), 'BK001');
const codes = (body: string, extra: Parameters<typeof checkReply>[0] = { body, facts }) =>
  checkReply({ ...extra, body }).issues.map((i) => i.code);

describe('extraction and normalisation', () => {
  it('treats different money spellings as the same paise value', () => {
    expect(findMoney('₹3,570 or Rs. 3570.00 or 3570 rupees').map((m) => m.value)).toEqual([
      357000, 357000, 357000,
    ]);
  });

  it('normalises dates written in several formats', () => {
    expect(
      findDates('14 Feb 2026, February 14, 2026, 2026-02-14 and 14/02/2026').map((d) => d.value),
    ).toEqual(['2026-02-14', '2026-02-14', '2026-02-14', '2026-02-14']);
  });

  it('normalises duration ranges and units', () => {
    expect(findDurations('within 24–48 hours, 5 to 7 working days').map((d) => d.value)).toEqual([
      '24-48 hours',
      '5-7 business days',
    ]);
  });
});

describe('checkReply', () => {
  const good =
    'Hi Priya, thank you for reaching out. Your pending royalty of ₹3,570 will be paid in the payout cycle that closes by 14 February 2026. The minimum payout is ₹1,000.';

  it('passes a reply whose every figure is backed by evidence', () => {
    const r = checkReply({ body: good, facts });
    expect(r.issues).toEqual([]);
    expect(r.passed).toBe(true);
  });

  it('blocks an invented amount, date and timeline', () => {
    const c = codes(
      'Hi Priya, we will pay ₹5,000 on 1 March 2026 and it takes 3 days to process, thank you.',
    );
    expect(c).toEqual(
      expect.arrayContaining(['UNSUPPORTED_AMOUNT', 'UNSUPPORTED_DATE', 'UNSUPPORTED_TIMELINE']),
    );
  });

  it('blocks placeholders and does not allow overriding them', () => {
    const r = checkReply({
      body: `${good} Your bank account is [CONFIRM: bank account linked?].`,
      facts,
    });
    expect(r.passed).toBe(false);
    expect(r.placeholders).toEqual(['[CONFIRM: bank account linked?]']);
    expect(canOverride(r)).toBe(false);
  });

  it('does not read ISBNs, ticket numbers or titles as claims', () => {
    const r = checkReply({
      body: `${good} Regarding ticket BL-1004 for ISBN 978-93-5XXXX-01-1 and "2025 Diaries".`,
      facts,
      ignorePhrases: ['2025 Diaries'],
    });
    expect(r.passed).toBe(true);
  });

  it('blocks internal leaks without override and guarantees with override', () => {
    expect(codes(`${good} Per kb.payout_threshold this is final.`)).toContain('INTERNAL_LEAK');
    const r = checkReply({ body: `${good} We guarantee it will arrive.`, facts });
    expect(r.issues.map((i) => i.code)).toContain('GUARANTEE');
    expect(canOverride(r)).toBe(true);
  });

  it('blocks claims citing unknown or missing evidence', () => {
    const r = checkReply({
      body: good,
      facts,
      claims: [
        { quote: 'Your bank account is linked', factIds: ['author.bank_account_linked'] },
        { quote: 'Something', factIds: ['made.up'] },
        { quote: 'Nothing cited', factIds: [] },
        { quote: 'Bank: [CONFIRM: is the bank linked?]', factIds: ['author.bank_account_linked'] },
      ],
    });
    expect(r.issues.map((i) => i.code)).toEqual([
      'CLAIM_ON_UNKNOWN',
      'CLAIM_WITHOUT_EVIDENCE',
      'CLAIM_WITHOUT_EVIDENCE',
    ]);
  });

  it('warns but does not block on a very short reply', () => {
    const r = checkReply({ body: 'Thanks, noted.', facts });
    expect(r.passed).toBe(true);
    expect(r.issues[0]?.code).toBe('TOO_SHORT');
  });
});

describe('slash dates that read two ways (F-20)', () => {
  const march4 = {
    id: 'record.paid_on',
    label: 'Paid on',
    type: 'DATE' as const,
    value: '2026-03-04',
    display: '4 March 2026',
    source: { kind: 'RECORD' as const, table: 'royalty', recordId: 'R1', field: 'paid_on' },
  };
  const dateCodes = (body: string) =>
    checkReply({ body, facts: [march4] }).issues.map((i) => i.code);

  it('does not pass 04/03/2026 against 4 March: a reader may take it as 3 April', () => {
    expect(dateCodes('It was paid on 04/03/2026.')).toContain('UNSUPPORTED_DATE');
    expect(dateCodes('It was paid on 03/04/2026.')).toContain('UNSUPPORTED_DATE');
  });

  it('still reads a slash date that can only mean one day', () => {
    expect(findDates('25/03/2026').map((d) => d.value)).toEqual(['2026-03-25']);
    expect(dateCodes('It was paid on 4 March 2026.')).not.toContain('UNSUPPORTED_DATE');
  });

  it('a slash date with the same day and month is not ambiguous', () => {
    expect(findDates('04/04/2026').map((d) => d.value)).toEqual(['2026-04-04']);
  });
});

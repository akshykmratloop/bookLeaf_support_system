import { describe, expect, it } from 'vitest';
import type { Fact } from '@bookleaf/shared';
import { accountLines, itemLines, type FieldLabel } from './customer-lines.js';

const fact = (id: string, label: string, display: string, kind = 'RECORD'): Fact => ({
  id,
  label,
  type: 'TEXT',
  value: display,
  display,
  source:
    kind === 'KB'
      ? { kind: 'KB', section: 's', rule: 'r' }
      : kind === 'MISSING'
        ? { kind: 'MISSING', reason: 'not sent' }
        : { kind: 'RECORD', table: 't', recordId: '1', field: 'f' },
});

const FIELDS: FieldLabel[] = [
  { key: 'acct.balance', label: 'Total balance', position: 10 },
  { key: 'acct.plan', label: 'Plan', position: 5 },
  { key: 'order.{id}.state', label: 'Order state (per order)', position: 20 },
  { key: 'order.{id}.total', label: 'Total (per order)', position: 30 },
];

describe('account lines of the Customer panel', () => {
  it("shows the product's lines first, then the workspace fields' facts in field order", () => {
    const lines = accountLines(
      [{ label: 'Balance', display: '$40' }],
      [fact('acct.balance', 'balance', '$40'), fact('acct.plan', 'plan', 'Pro')],
      FIELDS,
    );
    // "Total balance" repeats the product's "Balance" line with the same value: shown once.
    expect(lines).toEqual([
      { label: 'Balance', display: '$40' },
      { label: 'Plan', display: 'Pro' },
    ]);
  });

  it('leaves out facts with no field when the workspace has fields', () => {
    const lines = accountLines([], [fact('acct.secret', 'Internal', 'x')], FIELDS);
    expect(lines).toEqual([]);
  });

  it('with no fields defined, shows the record facts under their own labels (no policy facts)', () => {
    const facts = [
      fact('a.one', 'One', '1'),
      fact('kb.rule', 'Policy', '7 days', 'KB'),
      fact('a.gone', 'Gone', 'Unknown', 'MISSING'),
    ];
    expect(accountLines([], facts, [])).toEqual([{ label: 'One', display: '1' }]);
  });
});

describe('item lines of the Customer panel', () => {
  it('matches {id} fields to this item and drops the "(per …)" suffix', () => {
    const lines = itemLines(
      'A-7',
      [{ label: 'Total', display: '$12' }],
      [
        fact('order.A-7.state', 'state', 'Shipped'),
        fact('order.A-7.total', 'total', '$12'),
        fact('order.B-1.state', 'other item', 'Lost'),
      ],
      FIELDS,
    );
    expect(lines).toEqual([
      { label: 'Total', display: '$12' },
      { label: 'Order state', display: 'Shipped' },
    ]);
  });
});

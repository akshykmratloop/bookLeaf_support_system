import type { TicketCustomer } from '@bookleaf/shared';

/** Example data the boneyard CLI measures to capture the Customer panel's loading shape. */
export const CUSTOMER_PANEL_FIXTURE: TicketCustomer = {
  name: 'Sample Customer',
  email: 'sample.customer@example.com',
  externalId: 'CUST-001',
  recordsAvailable: true,
  itemNoun: 'item',
  account: [
    { label: 'Balance', display: '₹3,570' },
    { label: 'Plan', display: 'Standard' },
    { label: 'Next cycle', display: '14 Feb 2026' },
  ],
  items: [
    {
      id: null,
      externalId: 'ITEM-1',
      title: 'Sample item',
      isTicketItem: true,
      lines: [
        { label: 'Status', display: 'Active' },
        { label: 'Pending', display: '₹3,570' },
      ],
    },
  ],
  otherTickets: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      number: 'TKT-1001',
      subject: 'An earlier question',
      status: 'RESOLVED',
      createdAt: '2025-12-01T00:00:00.000Z',
    },
  ],
  otherTicketsTotal: 1,
};

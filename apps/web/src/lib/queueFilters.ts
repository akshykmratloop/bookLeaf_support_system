/** The admin queue's filter form. Empty strings mean "any". */
export interface QueueFilterValues {
  status: string;
  category: string;
  priority: string;
  assignee: string;
  from: string;
  to: string;
  q: string;
}

export const EMPTY_FILTERS: QueueFilterValues = {
  status: '',
  category: '',
  priority: '',
  assignee: '',
  from: '',
  to: '',
  q: '',
};

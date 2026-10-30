/** The admin queue's filter form. Empty strings mean "any". */
export interface QueueFilterValues {
  status: string;
  category: string;
  priority: string;
  assignee: string;
  from: string;
  to: string;
  q: string;
  /** '' is the default order: most urgent first. */
  sort: string;
}

export const EMPTY_FILTERS: QueueFilterValues = {
  status: '',
  category: '',
  priority: '',
  assignee: '',
  from: '',
  to: '',
  q: '',
  sort: '',
};

/** Filters narrow the list; the sort only orders it. */
export const isFiltered = ({ sort: _sort, ...rest }: QueueFilterValues) =>
  Object.values(rest).some(Boolean);

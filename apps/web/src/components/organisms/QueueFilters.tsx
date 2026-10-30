import { PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, TICKET_STATUSES } from '@bookleaf/shared';
import { useCategoryOptions } from '../../lib/categories';
import { Input } from '../atoms/Input';
import { Dropdown } from '../molecules/Dropdown';
import { FilterChips } from '../molecules/FilterChips';
import type { QueueFilterValues } from '../../lib/queueFilters';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  ...TICKET_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  ...PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] })),
];

const SORT_OPTIONS = [
  { value: '', label: 'Most urgent first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'newest', label: 'Newest first' },
];

const ASSIGNEE_OPTIONS = [
  { value: '', label: 'Anyone' },
  { value: 'me', label: 'Assigned to me' },
  { value: 'unassigned', label: 'Unassigned' },
];

export function QueueFilters({
  value,
  onChange,
}: {
  value: QueueFilterValues;
  onChange: (v: QueueFilterValues) => void;
}) {
  const set = (k: keyof QueueFilterValues) => (v: string) => onChange({ ...value, [k]: v });
  const categories = useCategoryOptions().data ?? [];
  return (
    <div className="mb-4 flex flex-col gap-3">
      <FilterChips
        label="Status"
        options={STATUS_OPTIONS}
        value={value.status}
        onChange={set('status')}
      />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <Input
          name="q"
          aria-label="Search subject or ticket number"
          placeholder="Search subject or ticket number"
          value={value.q}
          onChange={(e) => set('q')(e.target.value)}
          className="col-span-2"
        />
        <Dropdown
          id="queue-category"
          name="category"
          aria-label="Category"
          value={value.category}
          options={[
            { value: '', label: 'All categories' },
            ...categories.map((c) => ({ value: c.key, label: c.label })),
          ]}
          onChange={set('category')}
        />
        <Dropdown
          id="queue-priority"
          name="priority"
          aria-label="Priority"
          value={value.priority}
          options={PRIORITY_OPTIONS}
          onChange={set('priority')}
        />
        <Dropdown
          id="queue-assignee"
          name="assignee"
          aria-label="Assignee"
          value={value.assignee}
          options={ASSIGNEE_OPTIONS}
          onChange={set('assignee')}
        />
        <Dropdown
          id="queue-sort"
          name="sort"
          aria-label="Sort"
          value={value.sort}
          options={SORT_OPTIONS}
          onChange={set('sort')}
        />
        <div className="col-span-2 grid min-w-0 grid-cols-2 gap-1">
          <Input
            type="date"
            name="from"
            aria-label="Created from"
            value={value.from}
            onChange={(e) => set('from')(e.target.value)}
          />
          <Input
            type="date"
            name="to"
            aria-label="Created to"
            value={value.to}
            onChange={(e) => set('to')(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

import {
  CATEGORY_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
} from '@bookleaf/shared';
import { Input, Select } from '../atoms/Input';
import { FilterChips } from '../molecules/FilterChips';
import type { QueueFilterValues } from '../../lib/queueFilters';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  ...TICKET_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
];

export function QueueFilters({
  value,
  onChange,
}: {
  value: QueueFilterValues;
  onChange: (v: QueueFilterValues) => void;
}) {
  const set = (k: keyof QueueFilterValues) => (v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="mb-4 flex flex-col gap-3">
      <FilterChips
        label="Status"
        options={STATUS_OPTIONS}
        value={value.status}
        onChange={set('status')}
      />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <Input
          aria-label="Search subject or ticket number"
          placeholder="Search subject or BL-1001"
          value={value.q}
          onChange={(e) => set('q')(e.target.value)}
          className="col-span-2"
        />
        <Select
          aria-label="Category"
          value={value.category}
          onChange={(e) => set('category')(e.target.value)}
        >
          <option value="">All categories</option>
          {TICKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Priority"
          value={value.priority}
          onChange={(e) => set('priority')(e.target.value)}
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Assignee"
          value={value.assignee}
          onChange={(e) => set('assignee')(e.target.value)}
        >
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
        </Select>
        <div className="col-span-2 flex items-center gap-1 md:col-span-1">
          <Input
            type="date"
            aria-label="Created from"
            value={value.from}
            onChange={(e) => set('from')(e.target.value)}
          />
          <Input
            type="date"
            aria-label="Created to"
            value={value.to}
            onChange={(e) => set('to')(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

import { LIMIT_BOUNDS, LIMIT_KEYS, type LimitKey, type Plan } from '@bookleaf/shared';
import { Input } from '../../atoms/Input';
import { Field } from '../../molecules/Field';
import { LIMIT_LABELS } from '../../../lib/limitLabels';

interface Props {
  max: Plan['max'];
  onChange: (key: LimitKey, value: number) => void;
  errors: Partial<Record<LimitKey, string>>;
}

/** The most each customer limit may be set to. The customer picks its own value up to this. */
export function PlanLimits({ max, onChange, errors }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {LIMIT_KEYS.map((key) => {
        const b = LIMIT_BOUNDS[key];
        const id = `max-${key}`;
        return (
          <Field
            key={key}
            id={id}
            label={LIMIT_LABELS[key].label}
            hint={`${b.min}–${b.max} ${LIMIT_LABELS[key].unit}`}
            error={errors[key]}
          >
            <Input
              id={id}
              type="number"
              inputMode="numeric"
              min={b.min}
              max={b.max}
              step={1}
              value={Number.isFinite(max[key]) ? max[key] : ''}
              aria-invalid={Boolean(errors[key])}
              aria-describedby={errors[key] ? `${id}-error` : `${id}-hint`}
              onChange={(e) => onChange(key, e.target.valueAsNumber)}
            />
          </Field>
        );
      })}
    </div>
  );
}

/** Out-of-range or empty limits, keyed for the form. */
export function limitErrors(max: Plan['max']): Partial<Record<LimitKey, string>> {
  const out: Partial<Record<LimitKey, string>> = {};
  for (const key of LIMIT_KEYS) {
    const v = max[key];
    const b = LIMIT_BOUNDS[key];
    if (!Number.isInteger(v) || v < b.min || v > b.max)
      out[key] = `Use a whole number from ${b.min} to ${b.max}`;
  }
  return out;
}

import { Input } from '../atoms/Input';
import { Field } from '../molecules/Field';

interface Props {
  id: string;
  label: string;
  /** What the server keeps: a last-4 hint and when it was set. Null = nothing stored yet. */
  stored: { hint: string; updatedAt: string } | null;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
}

/** A write-only secret: the stored value is never shown, only its hint; typing replaces it. */
export function SecretField({ id, label, stored, value, onChange, hint, error }: Props) {
  const storedNote = stored
    ? `Stored: ${stored.hint}${stored.updatedAt !== new Date(0).toISOString() ? ` · set ${new Date(stored.updatedAt).toLocaleDateString()}` : ''}. Leave empty to keep it.`
    : 'Not set yet.';
  return (
    <Field id={id} label={label} hint={`${storedNote} ${hint ?? ''}`.trim()} error={error}>
      <Input
        id={id}
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={stored ? '••••••••' : ''}
        aria-invalid={Boolean(error)}
      />
    </Field>
  );
}

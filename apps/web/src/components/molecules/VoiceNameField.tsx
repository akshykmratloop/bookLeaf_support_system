import { Input, Select } from '../atoms/Input';
import { Field } from './Field';

interface Props {
  value: string;
  /** Voices the platform's voice provider offers; empty means free text. */
  voices: readonly string[];
  disabled: boolean;
  error?: string;
  onCommit: (voiceName: string) => void;
}

/** The assistant's voice: a list when the provider says which voices it has. */
export function VoiceNameField({ value, voices, disabled, error, onCommit }: Props) {
  return (
    <Field id="voiceName" label="Voice" error={error}>
      {voices.length > 0 ? (
        <Select
          id="voiceName"
          value={value}
          disabled={disabled}
          onChange={(e) => onCommit(e.target.value)}
        >
          {!voices.includes(value) && <option value={value}>{value}</option>}
          {voices.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          id="voiceName"
          defaultValue={value}
          disabled={disabled}
          onBlur={(e) => {
            if (e.target.value !== value) onCommit(e.target.value);
          }}
        />
      )}
    </Field>
  );
}

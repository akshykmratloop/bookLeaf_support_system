import { Input } from '../atoms/Input';
import { Dropdown } from './Dropdown';
import { Field } from './Field';

interface Props {
  value: string;
  /** Voices the platform's voice provider offers; empty means free text. */
  voices: readonly string[];
  disabled: boolean;
  error?: string;
  onCommit: (voiceName: string) => void;
}

/** The saved voice stays listed even when the provider no longer offers it. */
const voiceOptions = (value: string, voices: readonly string[]) =>
  (voices.includes(value) ? voices : [value, ...voices]).map((v) => ({ value: v, label: v }));

/** The assistant's voice: a list when the provider says which voices it has. */
export function VoiceNameField({ value, voices, disabled, error, onCommit }: Props) {
  return (
    <Field id="voiceName" label="Voice" error={error}>
      {voices.length > 0 ? (
        <Dropdown
          id="voiceName"
          value={value}
          disabled={disabled}
          options={voiceOptions(value, voices)}
          onChange={onCommit}
        />
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

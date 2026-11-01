import { useVoicePreview } from '../../lib/voicePreview';
import { Input } from '../atoms/Input';
import { SamplePlayButton } from '../atoms/SamplePlayButton';
import { Dropdown, type DropdownOption } from './Dropdown';
import { Field } from './Field';

interface Props {
  value: string;
  /** Voices the platform's voice provider offers; empty means free text. */
  voices: readonly string[];
  /** Pre-recorded sample per voice (voice → file path), shared by every workspace. */
  samples?: Readonly<Record<string, string>>;
  disabled: boolean;
  error?: string;
  onCommit: (voiceName: string) => void;
}

type Preview = ReturnType<typeof useVoicePreview>;

/** The saved voice stays listed even when the provider no longer offers it. */
const voiceOptions = (
  value: string,
  voices: readonly string[],
  samples: Readonly<Record<string, string>>,
  preview: Preview,
): DropdownOption[] =>
  (voices.includes(value) ? voices : [value, ...voices]).map((voice) => {
    const src = samples[voice];
    return {
      value: voice,
      label: voice,
      trailing: src ? (
        <SamplePlayButton
          size="row"
          voice={voice}
          isPlaying={preview.playing === voice}
          onToggle={() => preview.toggle(voice, src)}
        />
      ) : undefined,
    };
  });

const NO_SAMPLES: Readonly<Record<string, string>> = {};

/** The assistant's voice: a list with sample previews when the provider says which voices it has. */
export function VoiceNameField(props: Props) {
  const { value, voices, samples = NO_SAMPLES, disabled, error, onCommit } = props;
  const preview = useVoicePreview();
  const selectedSample = samples[value];
  return (
    <Field id="voiceName" label="Voice" error={error}>
      {voices.length > 0 ? (
        <div className="flex items-center gap-2">
          <Dropdown
            id="voiceName"
            className="flex-1"
            listClassName="min-w-44"
            value={value}
            disabled={disabled}
            options={voiceOptions(value, voices, samples, preview)}
            onChange={onCommit}
          />
          {selectedSample ? (
            <SamplePlayButton
              voice={value}
              isPlaying={preview.playing === value}
              onToggle={() => preview.toggle(value, selectedSample)}
            />
          ) : null}
        </div>
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

import { Eye, EyeOff } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { Input } from '../atoms/Input';
import { Field } from './Field';

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  /** Shown under the field; a Caps Lock warning takes its place while Caps Lock is on. */
  hint?: string;
  name?: string;
  /** "new-password" on signup, so the browser offers to save it instead of filling an old one. */
  autoComplete?: 'current-password' | 'new-password';
}

/** Password with a show/hide toggle and a Caps Lock warning. */
export function PasswordField({
  id,
  value,
  onChange,
  error,
  label = 'Password',
  hint,
  name,
  autoComplete = 'current-password',
}: Props) {
  const [isShown, setShown] = useState(false);
  const [isCapsOn, setCapsOn] = useState(false);
  const checkCaps = (e: KeyboardEvent<HTMLInputElement>) =>
    setCapsOn(e.getModifierState('CapsLock'));
  const shownHint = isCapsOn ? 'Caps Lock is on.' : hint;
  return (
    <Field id={id} label={label} error={error} hint={shownHint}>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={isShown ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={checkCaps}
          onKeyDown={checkCaps}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : shownHint ? `${id}-hint` : undefined}
          className="pr-11"
          required
        />
        <button
          type="button"
          onClick={() => setShown(!isShown)}
          aria-label={isShown ? 'Hide password' : 'Show password'}
          aria-pressed={isShown}
          aria-controls={id}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-control text-ink-3 hover:text-ink"
        >
          {isShown ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </button>
      </div>
    </Field>
  );
}

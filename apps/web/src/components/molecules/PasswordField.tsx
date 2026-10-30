import { Eye, EyeOff } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { Input } from '../atoms/Input';
import { Field } from './Field';

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/** Password with a show/hide toggle and a Caps Lock warning. */
export function PasswordField({ id, value, onChange, error }: Props) {
  const [isShown, setShown] = useState(false);
  const [isCapsOn, setCapsOn] = useState(false);
  const checkCaps = (e: KeyboardEvent<HTMLInputElement>) =>
    setCapsOn(e.getModifierState('CapsLock'));
  return (
    <Field id={id} label="Password" error={error} hint={isCapsOn ? 'Caps Lock is on.' : undefined}>
      <div className="relative">
        <Input
          id={id}
          type={isShown ? 'text' : 'password'}
          autoComplete="current-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={checkCaps}
          onKeyDown={checkCaps}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : isCapsOn ? `${id}-hint` : undefined}
          className="pr-11"
          required
        />
        <button
          type="button"
          onClick={() => setShown(!isShown)}
          aria-label={isShown ? 'Hide password' : 'Show password'}
          aria-pressed={isShown}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-control text-ink-3 hover:text-ink"
        >
          {isShown ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </button>
      </div>
    </Field>
  );
}

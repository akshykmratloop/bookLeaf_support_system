import { Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { useState, type InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Password fields get a show/hide toggle. */
  revealable?: boolean;
}

/** A field whose label floats above the text once there is something in it. */
export function Field({ id, label, icon: Icon, revealable, type, ...rest }: Props) {
  const [shown, setShown] = useState(false);
  return (
    <div className="group relative">
      <Icon
        size={17}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3 transition-colors group-focus-within:text-brand-ink"
      />
      <input
        id={id}
        type={revealable && shown ? 'text' : type}
        placeholder=" "
        {...rest}
        className="peer h-14 w-full rounded-2xl border border-line bg-panel/90 pt-4 pr-12 pl-11 text-[15px] text-ink shadow-[inset_0_1px_2px_rgb(47_46_46/0.04)] transition focus:border-brand/60 focus:ring-4 focus:ring-brand/15 focus:outline-none"
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute top-1/2 left-11 -translate-y-1/2 text-[14.5px] text-ink-3 transition-all peer-focus:top-4 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:text-brand-ink peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-semibold"
      >
        {label}
      </label>
      {revealable ? (
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          className="absolute top-1/2 right-3 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:bg-panel-2 hover:text-ink"
        >
          {shown ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
        </button>
      ) : null}
    </div>
  );
}

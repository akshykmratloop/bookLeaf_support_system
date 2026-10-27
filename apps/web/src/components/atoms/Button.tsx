import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand text-white border border-transparent shadow-soft hover:bg-brand-strong active:translate-y-px',
  secondary: 'bg-panel text-ink border border-line-strong shadow-soft hover:border-brand',
  soft: 'bg-brand-soft text-brand border border-transparent hover:border-brand/40',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-panel-2 hover:text-ink',
  danger: 'bg-danger-bg text-danger border border-transparent hover:border-danger',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[12.5px]',
  md: 'h-10 px-4 text-[13.5px]',
  lg: 'h-12 px-6 text-[15px]',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
  isLoading?: boolean;
  size?: Size;
  /** Fully rounded, for chips and floating actions. */
  pill?: boolean;
}

export function Button({
  variant = 'primary',
  icon,
  isLoading = false,
  size = 'md',
  pill = false,
  className = '',
  children,
  disabled,
  ...rest
}: Props) {
  const shape = pill ? 'rounded-full' : 'rounded-control';
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${shape} ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
    >
      {isLoading ? <Spinner size={14} /> : icon}
      {children}
    </button>
  );
}

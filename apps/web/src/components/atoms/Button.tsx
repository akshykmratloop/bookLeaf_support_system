import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-strong text-white hover:bg-brand border border-transparent',
  secondary: 'bg-panel-2 text-ink border border-line-strong hover:border-brand',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-panel-2 hover:text-ink',
  danger: 'bg-danger-bg text-danger border border-transparent hover:border-danger',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
  isLoading?: boolean;
  size?: 'sm' | 'md';
}

export function Button({ variant = 'primary', icon, isLoading = false, size = 'md', className = '', children, disabled, ...rest }: Props) {
  const height = size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-4 text-[12.5px]';
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-[9px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${height} ${VARIANTS[variant]} ${className}`}
    >
      {isLoading ? <Spinner size={14} /> : icon}
      {children}
    </button>
  );
}

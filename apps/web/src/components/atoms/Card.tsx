import type { HTMLAttributes } from 'react';

type Variant = 'outline' | 'elevated' | 'flat';

const VARIANTS: Record<Variant, string> = {
  outline: 'border border-line bg-panel shadow-soft',
  elevated: 'border border-line/60 bg-panel shadow-lift',
  flat: 'bg-panel-2',
};

interface Props extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

export function Card({ variant = 'outline', className = '', ...rest }: Props) {
  return <div {...rest} className={`rounded-card ${VARIANTS[variant]} ${className}`} />;
}

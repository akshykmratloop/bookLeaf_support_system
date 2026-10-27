import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

export const controlClass =
  'w-full rounded-[9px] border border-line bg-inset px-3 text-[13.5px] text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none disabled:opacity-60 aria-[invalid=true]:border-danger';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return <input ref={ref} {...rest} className={`h-[38px] ${controlClass} ${className}`} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = '', ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      {...rest}
      className={`py-2.5 leading-relaxed ${controlClass} ${className}`}
    />
  );
});

export function Select({
  className = '',
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`h-[38px] ${controlClass} ${className}`}>
      {children}
    </select>
  );
}

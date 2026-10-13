import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/shared/cn';

const control =
  'w-full rounded-md border-[1.5px] border-transparent bg-soft px-3.5 py-3 text-base text-ink ' +
  'transition-colors focus:border-gold-text focus:bg-surface focus:outline-none ' +
  'aria-invalid:border-danger aria-invalid:bg-danger-soft';

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optionalLabel?: string;
  className?: string;
  children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: true;
  }) => ReactNode;
};

/** Label + control + hint + error, wired together for screen readers. */
export function Field({ label, hint, error, optionalLabel, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {optionalLabel && <span className="text-muted ml-1 font-normal">{optionalLabel}</span>}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        ...(error ? { 'aria-invalid': true as const } : {}),
      })}
      {hint && (
        <p id={hintId} className="text-muted text-sm">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-danger text-sm font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(control, 'min-h-20 resize-y', className)} {...props} />;
}

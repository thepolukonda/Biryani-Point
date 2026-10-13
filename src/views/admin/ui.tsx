/** Small shared building blocks for admin forms (English UI, big touch targets). */
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/shared/cn';

export const inputClass =
  'w-full min-h-11 rounded-md border-[1.5px] border-line bg-surface px-3 py-2 text-base focus:border-gold-text focus:outline-none disabled:bg-soft disabled:text-muted';

export function Card({
  title,
  description,
  children,
  className,
  badge,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  badge?: ReactNode;
}) {
  return (
    <section className={cn('bg-surface shadow-card rounded-2xl p-5 md:p-6', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold">{title}</h2>
          {description && <p className="text-muted mt-0.5 text-sm">{description}</p>}
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

export function Labeled({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  // Label and hint on top, the field at the bottom: fields in the same row line up even
  // when one of them has a longer hint.
  return (
    <label className={cn('flex flex-col gap-1 text-sm font-semibold', className)}>
      {label}
      {hint && <span className="text-muted -mt-0.5 font-normal">{hint}</span>}
      <span className="mt-auto grid">{children}</span>
    </label>
  );
}

export function Check({
  label,
  className,
  ...props
}: ComponentProps<'input'> & { label: ReactNode }) {
  return (
    <label className={cn('flex min-h-11 cursor-pointer items-center gap-3 text-[15px]', className)}>
      <input type="checkbox" className="size-5 accent-[var(--color-gold-text)]" {...props} />
      {label}
    </label>
  );
}

export function SubmitButton({
  children,
  pending,
  className,
}: {
  children: ReactNode;
  pending?: boolean;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'bg-ink min-h-12 rounded-md px-5 font-semibold text-white hover:bg-black disabled:opacity-60',
        className,
      )}
    >
      {pending ? 'Saving…' : children}
    </button>
  );
}

export function FormMessage({ state }: { state: { message?: string; error?: string } }) {
  if (state.error)
    return (
      <p
        role="alert"
        className="bg-danger-soft text-danger rounded-md px-3 py-2 text-sm font-semibold"
      >
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" className="bg-ok-soft text-ok rounded-md px-3 py-2 text-sm font-semibold">
        {state.message}
      </p>
    );
  return null;
}

export function SheetBadge() {
  return (
    <span
      className="bg-gold-soft text-gold-text rounded-full px-3 py-1 text-xs font-bold"
      title="Change this in the Google Sheet"
    >
      From Google Sheet
    </span>
  );
}

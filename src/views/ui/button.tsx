import type { ComponentProps } from 'react';
import { Link } from '@/config/i18n/navigation';
import { cn } from '@/shared/cn';

export type ButtonVariant =
  'primary' | 'dark' | 'soft' | 'outline' | 'whatsapp' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-gold text-on-gold hover:bg-gold-hover',
  dark: 'bg-ink text-white hover:bg-black',
  soft: 'bg-soft text-ink hover:bg-soft-2',
  outline: 'border border-line-strong bg-surface text-ink hover:border-ink',
  whatsapp: 'bg-whatsapp text-white hover:brightness-110',
  ghost: 'text-ink hover:bg-soft',
  danger: 'bg-danger text-white hover:brightness-110',
};

// Every size is at least 44px tall: comfortable touch targets (WCAG 2.5.8 asks for 24px minimum).
const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-4 text-sm',
  md: 'min-h-12 px-5 text-[15px]',
  lg: 'min-h-14 px-6 text-base',
  icon: 'size-11 p-0',
};

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold text-center leading-tight',
    'transition-[background-color,transform,filter,border-color] duration-150 active:scale-[0.98]',
    'disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45',
    '[&_svg]:size-[18px] [&_svg]:shrink-0',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

type Common = { variant?: ButtonVariant; size?: ButtonSize };

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & Common) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}

/** A link that looks like a button. Locale-aware for internal paths. */
export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & Common) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}

/** External link (WhatsApp, maps, phone) styled as a button. */
export function ButtonAnchor({ variant, size, className, ...props }: ComponentProps<'a'> & Common) {
  return <a className={buttonClasses({ variant, size, className })} {...props} />;
}

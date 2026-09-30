import { cn } from '@/lib/cn';

/**
 * The round logo: black disc, gold ring and the monogram (e.g. "BP", from the business
 * profile). Decorative unless given a label.
 */
export function Roundel({
  monogram,
  className,
  label,
}: {
  monogram: string;
  className?: string;
  label?: string;
}) {
  // Three letters need a smaller size to fit inside the ring.
  const fontSize = monogram.length > 2 ? 26 : 34;
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn('shrink-0', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="50" cy="50" r="48" fill="#0a0a0a" />
      <circle cx="50" cy="50" r="41" fill="none" stroke="#e9a72d" strokeWidth="2.5" />
      <text
        x="50"
        y="62"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize={fontSize}
        fill="#e9a72d"
        letterSpacing="1"
      >
        {monogram}
      </text>
    </svg>
  );
}

/**
 * Roundel + wordmark, e.g. "BIRYANI POINT / BATUMI": the brand name with its last word in
 * gold, and the city underneath (brand block from the prototype).
 */
export function Logo({
  brand,
  className,
  tone = 'light',
  size = 'md',
}: {
  brand: { name: string; monogram: string; city: string };
  className?: string;
  tone?: 'light' | 'dark';
  size?: 'sm' | 'md';
}) {
  const words = brand.name.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop() : undefined;
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Roundel monogram={brand.monogram} className={size === 'sm' ? 'size-9' : 'size-10'} />
      <span className="leading-none" translate="no">
        <span
          className={cn(
            'block font-black tracking-[0.12em] whitespace-nowrap uppercase',
            size === 'sm' ? 'text-[13px]' : 'text-[17px]',
            tone === 'dark' ? 'text-on-night' : 'text-ink',
          )}
        >
          {words.join(' ')}
          {last && (
            <>
              {' '}
              <span className={tone === 'dark' ? 'text-gold' : 'text-gold-text'}>{last}</span>
            </>
          )}
        </span>
        {brand.city && (
          <span
            className={cn(
              'mt-1 block tracking-[0.35em] uppercase',
              size === 'sm' ? 'text-[8px]' : 'text-[9px]',
              tone === 'dark' ? 'text-on-night-muted' : 'text-muted',
            )}
          >
            {brand.city}
          </span>
        )}
      </span>
    </span>
  );
}

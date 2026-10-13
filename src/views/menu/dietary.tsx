import { cn } from '@/shared/cn';
import type { SpiceLevel } from '@/shared/domain/menu';

/** Indian food-label mark: green square with a dot (veg) or brown square with a triangle (non-veg). */
export function VegMark({
  veg,
  label,
  className,
}: {
  veg: boolean;
  label: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'inline-grid size-3.5 shrink-0 place-items-center rounded-[3px] border-[1.5px] bg-white',
        veg ? 'border-veg' : 'border-nonveg',
        className,
      )}
    >
      {veg ? (
        <span className="bg-veg size-1.5 rounded-full" />
      ) : (
        <span className="border-b-nonveg h-0 w-0 border-x-[3.5px] border-b-[6px] border-x-transparent" />
      )}
    </span>
  );
}

function Chilli({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-3.5', filled ? 'text-chili' : 'text-line-strong')}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M17.7 3.3c.4-.4 1-.4 1.4 0 .4.4.4 1 0 1.4l-.8.8c1 1.2 1.3 2.9.7 4.5-1.6 4.2-6.4 9.6-13.2 10.9-.8.2-1.4-.7-1-1.4 1.6-2.7 2.4-5.3 3.4-7.7 1-2.4 2.7-4.3 5.1-5 1.1-.3 2.2-.2 3.1.2l1.3-1.3z"
      />
    </svg>
  );
}

/** 1–3 chillies. Level 0 or unknown renders nothing. */
export function SpiceMeter({ level, label }: { level: SpiceLevel | null; label: string }) {
  if (!level) return null;
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex items-center">
      {[1, 2, 3].map((n) => (
        <Chilli key={n} filled={n <= level} />
      ))}
    </span>
  );
}

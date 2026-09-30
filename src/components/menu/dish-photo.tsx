import Image from 'next/image';
import { Roundel } from '@/components/brand/logo';
import { cn } from '@/lib/cn';
import { menuImageUrl } from '@/lib/images';

/** Dish photo through next/image (AVIF/WebP, right size per screen), or a branded placeholder. */
export function DishPhoto({
  monogram,
  path,
  alt,
  sizes,
  className,
  priority = false,
  soldOut = false,
}: {
  /** The logo letters shown on the placeholder when there is no photo. */
  monogram: string;
  path: string | null;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  soldOut?: boolean;
}) {
  return (
    <div className={cn('bg-gold-soft relative overflow-hidden', className)}>
      {path ? (
        <Image
          src={menuImageUrl(path)}
          alt={alt}
          fill
          sizes={sizes}
          {...(priority ? { loading: 'eager' as const, fetchPriority: 'high' as const } : {})}
          className={cn('object-cover', soldOut && 'opacity-50 grayscale')}
        />
      ) : (
        <div className="grid size-full place-items-center">
          <Roundel monogram={monogram} className="size-1/3 opacity-70" />
        </div>
      )}
    </div>
  );
}

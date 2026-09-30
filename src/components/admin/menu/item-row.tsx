'use client';

import Image from 'next/image';
import { useRef, useState, useTransition } from 'react';
import { move, setItemPhoto, setSoldOut } from '@/app/admin/_actions/menu';
import { uploadDishPhoto } from '@/lib/admin/photo';
import { cn } from '@/lib/cn';
import { pickText, type I18nText } from '@/lib/domain/i18n-text';
import { formatAmount } from '@/lib/domain/money';
import { menuImageUrl } from '@/lib/images';
import type { ItemRow } from './types';
import { useAdminBrand } from '../admin-brand';

const small = 'min-h-11 rounded-md px-3 text-sm font-semibold disabled:opacity-50';

export function ItemRowView({
  item,
  isOwner,
  editable,
  onEdit,
}: {
  item: ItemRow;
  isOwner: boolean;
  editable: boolean;
  onEdit: () => void;
}) {
  const { timezone } = useAdminBrand();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const soldOutUntil = item.sold_out_until ? new Date(item.sold_out_until) : null;
  const kitchenSoldOut = soldOutUntil !== null && soldOutUntil > new Date();
  const indefinite = kitchenSoldOut && soldOutUntil!.getUTCFullYear() > 2090;
  const name = pickText(item.name as I18nText, 'en');

  const act = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError('');
      const result = await fn();
      if (result.error) setError(result.error);
    });

  return (
    <li
      className={cn(
        'border-line flex flex-wrap items-center gap-3 border-b py-3 last:border-0',
        !item.is_visible && 'opacity-60',
      )}
    >
      <div className="bg-soft relative size-16 shrink-0 overflow-hidden rounded-lg">
        {item.photo_path && (
          <Image
            src={menuImageUrl(item.photo_path)}
            alt=""
            fill
            sizes="64px"
            className="object-cover"
          />
        )}
      </div>
      <div className="min-w-40 flex-1">
        <p className="font-bold">{name}</p>
        <p className="text-muted text-sm">
          GEL {formatAmount(item.price_tetri)}
          {!item.is_visible && ' · hidden'}
          {!item.is_available && ' · off in the menu source'}
        </p>
        {kitchenSoldOut && (
          <p className="text-danger text-sm font-bold">
            Sold out{' '}
            {indefinite
              ? 'until turned back on'
              : `until ${new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(soldOutUntil!)}`}
          </p>
        )}
        {error && <p className="text-danger text-sm font-semibold">{error}</p>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {kitchenSoldOut ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => act(() => setSoldOut(item.id, 'off'))}
            className={cn(small, 'bg-veg text-white')}
          >
            Back on the menu
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => setSoldOut(item.id, 'today'))}
              className={cn(small, 'bg-danger text-white')}
              aria-label={`Mark ${name} sold out for today`}
            >
              Sold out today
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => setSoldOut(item.id, 'indefinite'))}
              className={cn(small, 'bg-danger-soft text-danger')}
              aria-label={`Mark ${name} sold out until turned back on`}
            >
              Until I turn it on
            </button>
          </>
        )}
        {isOwner && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label={`Upload a photo for ${name}`}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                act(async () => {
                  try {
                    const path = await uploadDishPhoto(item.slug, file);
                    return await setItemPhoto(item.id, path);
                  } catch (err) {
                    return { error: (err as Error).message };
                  }
                });
              }}
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => fileInput.current?.click()}
              className={cn(small, 'bg-soft')}
            >
              {pending ? 'Working…' : item.photo_path ? 'Change photo' : 'Add photo'}
            </button>
          </>
        )}
        {isOwner && editable && (
          <>
            <button type="button" onClick={onEdit} className={cn(small, 'bg-ink text-white')}>
              Edit
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => move('menu_items', item.id, -1))}
              className={cn(small, 'bg-soft')}
              aria-label={`Move ${name} up`}
            >
              ↑
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => move('menu_items', item.id, 1))}
              className={cn(small, 'bg-soft')}
              aria-label={`Move ${name} down`}
            >
              ↓
            </button>
          </>
        )}
      </div>
    </li>
  );
}

'use client';

import { useCallback, useState, useTransition } from 'react';
import { move } from '@/app/admin/_actions/menu';
import { pickText, type I18nText } from '@/lib/domain/i18n-text';
import { formatAmount } from '@/lib/domain/money';
import { CategoryEditor, GroupEditor, ItemEditor } from './editors';
import { ItemRowView } from './item-row';
import { SyncPanel } from './sync-panel';
import type { CategoryRow, GroupRow, ItemRow, MenuAdminData } from './types';

type Editing =
  | { kind: 'item'; item: ItemRow | null }
  | { kind: 'category'; category: CategoryRow | null }
  | { kind: 'group'; group: GroupRow | null }
  | null;

export function MenuManager({ data }: { data: MenuAdminData }) {
  const [editing, setEditing] = useState<Editing>(null);
  const [pending, start] = useTransition();
  const editable = data.source === 'admin';
  const close = useCallback(() => setEditing(null), []);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Menu</h1>
        {data.isOwner && editable && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditing({ kind: 'item', item: null })}
              className="bg-ink min-h-12 rounded-md px-5 font-semibold text-white"
            >
              + Add dish
            </button>
            <button
              type="button"
              onClick={() => setEditing({ kind: 'category', category: null })}
              className="bg-surface shadow-card min-h-12 rounded-md px-5 font-semibold"
            >
              + Category
            </button>
            <button
              type="button"
              onClick={() => setEditing({ kind: 'group', group: null })}
              className="bg-surface shadow-card min-h-12 rounded-md px-5 font-semibold"
            >
              + Option group
            </button>
          </div>
        )}
      </div>

      <p className="bg-gold-soft text-gold-text rounded-lg px-4 py-3">
        <b>Sold out?</b> Tap <b>Sold out today</b>: the dish comes back automatically tomorrow
        morning.{' '}
        {data.source === 'sheet'
          ? 'Names, prices and options are edited in the Google Sheet; photos are uploaded here.'
          : 'The menu is edited here (the Google Sheet is switched off in Settings).'}
      </p>

      {data.source === 'sheet' && (
        <SyncPanel runs={data.runs} configured={data.sheetConfigured} isOwner={data.isOwner} />
      )}

      {data.categories.map((category) => {
        const items = data.items.filter((i) => i.category_id === category.id);
        return (
          <section
            key={category.id}
            aria-labelledby={`cat-${category.id}`}
            className="bg-surface shadow-card rounded-2xl p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id={`cat-${category.id}`} className="text-xl font-extrabold">
                {pickText(category.name as I18nText, 'en')}{' '}
                <span className="text-muted text-sm font-medium">
                  {items.length} dishes{!category.is_visible && ' · hidden'}
                </span>
              </h2>
              {data.isOwner && editable && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditing({ kind: 'category', category })}
                    className="bg-soft min-h-11 rounded-md px-3 text-sm font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => void (await move('categories', category.id, -1)))
                    }
                    className="bg-soft min-h-11 rounded-md px-3 text-sm font-semibold"
                    aria-label="Move category up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => void (await move('categories', category.id, 1)))
                    }
                    className="bg-soft min-h-11 rounded-md px-3 text-sm font-semibold"
                    aria-label="Move category down"
                  >
                    ↓
                  </button>
                </div>
              )}
            </div>
            <ul className="mt-2">
              {items.map((item) => (
                <ItemRowView
                  key={item.id}
                  item={item}
                  isOwner={data.isOwner}
                  editable={editable}
                  onEdit={() => setEditing({ kind: 'item', item })}
                />
              ))}
            </ul>
          </section>
        );
      })}

      <section className="bg-surface shadow-card rounded-2xl p-5" aria-labelledby="groups-title">
        <h2 id="groups-title" className="text-xl font-extrabold">
          Option groups
        </h2>
        <p className="text-muted text-sm">
          Choices customers make for a dish, like spice level or size.
        </p>
        <ul className="mt-3 grid gap-2">
          {data.groups.map((g) => (
            <li
              key={g.id}
              className="bg-soft flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3"
            >
              <span>
                <b>{pickText(g.name as I18nText, 'en')}</b>{' '}
                <span className="text-muted text-sm">
                  {g.min_select > 0 ? 'required' : 'optional'} ·{' '}
                  {g.modifier_options
                    .map(
                      (o) =>
                        `${pickText(o.name as I18nText, 'en')}${o.price_delta_tetri ? ` (+${formatAmount(o.price_delta_tetri)})` : ''}`,
                    )
                    .join(', ')}
                </span>
              </span>
              {data.isOwner && editable && (
                <button
                  type="button"
                  onClick={() => setEditing({ kind: 'group', group: g })}
                  className="bg-surface min-h-11 rounded-md px-3 text-sm font-semibold"
                >
                  Edit
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {editing?.kind === 'item' && (
        <ItemEditor
          item={editing.item}
          categories={data.categories}
          groups={data.groups}
          links={data.links}
          onClose={close}
        />
      )}
      {editing?.kind === 'category' && (
        <CategoryEditor category={editing.category} onClose={close} />
      )}
      {editing?.kind === 'group' && <GroupEditor group={editing.group} onClose={close} />}
    </div>
  );
}

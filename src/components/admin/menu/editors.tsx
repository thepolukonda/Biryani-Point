'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import {
  deleteGroup,
  saveCategory,
  saveGroup,
  saveItem,
  type FormState,
} from '@/app/admin/_actions/menu';
import { pickText, type I18nText } from '@/lib/domain/i18n-text';
import { formatAmount } from '@/lib/domain/money';
import { slugify } from '@/lib/sheet/cells';
import { Check, FormMessage, inputClass, Labeled, SubmitButton } from '../ui';
import type { CategoryRow, GroupRow, ItemRow, LinkRow } from './types';

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className="bg-surface shadow-lift backdrop:bg-ink/50 m-auto max-h-[92dvh] w-[min(720px,100%-24px)] overflow-y-auto rounded-2xl p-0"
    >
      <div className="border-line bg-surface sticky top-0 z-10 flex items-center justify-between border-b px-5 py-3">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="hover:bg-soft min-h-11 rounded-md px-3 font-semibold"
        >
          Close
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}

function I18nFields({
  base,
  label,
  value,
  multiline = false,
  required = false,
}: {
  base: string;
  label: string;
  value: I18nText | Record<string, string> | null;
  multiline?: boolean;
  required?: boolean;
}) {
  const v = (value ?? {}) as Record<string, string | undefined>;
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <fieldset className="grid gap-2 sm:grid-cols-3">
      <legend className="mb-1 text-sm font-bold">{label}</legend>
      {(['en', 'ka', 'ru'] as const).map((l) => (
        <Labeled
          key={l}
          label={
            { en: 'English', ka: 'Georgian', ru: 'Russian' }[l] +
            (l === 'en' && required ? ' *' : '')
          }
        >
          <Tag
            name={`${base}_${l}`}
            defaultValue={v[l] ?? ''}
            required={l === 'en' && required}
            lang={l}
            className={inputClass}
            {...(multiline ? { rows: 3 } : {})}
          />
        </Labeled>
      ))}
    </fieldset>
  );
}

export function ItemEditor({
  item,
  categories,
  groups,
  links,
  onClose,
}: {
  item: ItemRow | null;
  categories: CategoryRow[];
  groups: GroupRow[];
  links: LinkRow[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveItem, {});
  const [slug, setSlug] = useState(item?.slug ?? '');
  const linked = new Set(links.filter((l) => l.item_id === item?.id).map((l) => l.group_id));
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Dialog
      title={item ? `Edit ${pickText(item.name as I18nText, 'en')}` : 'Add a dish'}
      onClose={onClose}
    >
      <form action={action} className="grid gap-4">
        {item && <input type="hidden" name="id" value={item.id} />}
        <I18nFields base="name" label="Name" value={item?.name as I18nText} required />
        <Labeled
          label="Id (used in links and the cart)"
          hint="Lowercase letters, numbers and dashes. Changing it breaks saved carts."
        >
          <input
            name="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onFocus={(e) => {
              if (!slug)
                setSlug(
                  slugify(
                    (e.currentTarget.form?.elements.namedItem('name_en') as HTMLInputElement)
                      ?.value ?? '',
                  ),
                );
            }}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className={inputClass}
          />
        </Labeled>
        <I18nFields
          base="desc"
          label="Description"
          value={item?.description as I18nText}
          multiline
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Labeled label="Price (GEL) *">
            <input
              name="price"
              defaultValue={item ? formatAmount(item.price_tetri) : ''}
              inputMode="decimal"
              required
              className={inputClass}
            />
          </Labeled>
          <Labeled label="Category *">
            <select
              name="category_id"
              defaultValue={item?.category_id ?? categories[0]?.id}
              className={inputClass}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {pickText(c.name as I18nText, 'en')}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Spice level">
            <select
              name="spice_level"
              defaultValue={item?.spice_level?.toString() ?? ''}
              className={inputClass}
            >
              <option value="">Not shown</option>
              <option value="0">Not spicy</option>
              <option value="1">Mild</option>
              <option value="2">Medium</option>
              <option value="3">Hot</option>
            </select>
          </Labeled>
        </div>
        <Labeled label="Allergens" hint="Comma separated, e.g. dairy, nuts, gluten">
          <input
            name="allergens"
            defaultValue={item?.allergens.join(', ') ?? ''}
            className={inputClass}
          />
        </Labeled>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Check name="is_veg" label="Vegetarian" defaultChecked={item?.is_veg ?? false} />
          <Check
            name="is_popular"
            label="Popular (shown in the Popular row)"
            defaultChecked={item?.is_popular ?? false}
          />
          <Check
            name="is_available"
            label="Available"
            defaultChecked={item?.is_available ?? true}
          />
          <Check
            name="is_visible"
            label="Show on the menu"
            defaultChecked={item?.is_visible ?? true}
          />
        </div>
        {groups.length > 0 && (
          <fieldset>
            <legend className="mb-1 text-sm font-bold">Option groups for this dish</legend>
            {groups.map((g) => (
              <Check
                key={g.id}
                name="group_ids"
                value={g.id}
                defaultChecked={linked.has(g.id)}
                label={pickText(g.name as I18nText, 'en')}
              />
            ))}
          </fieldset>
        )}
        <FormMessage state={state} />
        <SubmitButton pending={pending}>{item ? 'Save dish' : 'Add dish'}</SubmitButton>
      </form>
    </Dialog>
  );
}

export function CategoryEditor({
  category,
  onClose,
}: {
  category: CategoryRow | null;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCategory, {});
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);
  return (
    <Dialog title={category ? 'Edit category' : 'Add a category'} onClose={onClose}>
      <form action={action} className="grid gap-4">
        {category && <input type="hidden" name="id" value={category.id} />}
        <I18nFields base="name" label="Name" value={category?.name as I18nText} required />
        <Labeled label="Id" hint="Lowercase letters, numbers and dashes, e.g. biryani">
          <input
            name="slug"
            defaultValue={category?.slug ?? ''}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className={inputClass}
          />
        </Labeled>
        <I18nFields base="blurb" label="Short description" value={category?.blurb as I18nText} />
        <Check
          name="is_visible"
          label="Show on the menu"
          defaultChecked={category?.is_visible ?? true}
        />
        <FormMessage state={state} />
        <SubmitButton pending={pending}>Save category</SubmitButton>
      </form>
    </Dialog>
  );
}

type OptionDraft = {
  slug: string;
  name_en: string;
  name_ka: string;
  name_ru: string;
  price: string;
  is_default: boolean;
  is_available: boolean;
};

export function GroupEditor({ group, onClose }: { group: GroupRow | null; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<FormState>({});
  const name = (group?.name ?? {}) as Record<string, string>;
  const [draft, setDraft] = useState({
    slug: group?.slug ?? '',
    name_en: name.en ?? '',
    name_ka: name.ka ?? '',
    name_ru: name.ru ?? '',
    min_select: group?.min_select ?? 0,
    max_select: group?.max_select ?? 1,
  });
  const [options, setOptions] = useState<OptionDraft[]>(
    (group?.modifier_options ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((o) => {
        const n = o.name as Record<string, string>;
        const p = o.price_delta_tetri;
        return {
          slug: o.slug,
          name_en: n.en ?? '',
          name_ka: n.ka ?? '',
          name_ru: n.ru ?? '',
          price: p === 0 ? '0' : `${p < 0 ? '-' : '+'}${formatAmount(Math.abs(p))}`,
          is_default: o.is_default,
          is_available: o.is_available,
        };
      }),
  );
  const setOption = (i: number, patch: Partial<OptionDraft>) =>
    setOptions((list) => list.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  const save = () =>
    start(async () => {
      const result = await saveGroup({
        ...(group ? { id: group.id } : {}),
        ...draft,
        slug: draft.slug || slugify(draft.name_en),
        options: options.map((o) => ({ ...o, slug: o.slug || slugify(o.name_en) })),
      });
      setState(result);
      if (result.ok) onClose();
    });

  return (
    <Dialog title={group ? 'Edit option group' : 'Add an option group'} onClose={onClose}>
      <div className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {(['en', 'ka', 'ru'] as const).map((l) => (
            <Labeled key={l} label={`Group name (${l})${l === 'en' ? ' *' : ''}`}>
              <input
                value={draft[`name_${l}`]}
                onChange={(e) => setDraft({ ...draft, [`name_${l}`]: e.target.value })}
                lang={l}
                className={inputClass}
              />
            </Labeled>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Labeled label="Customer must choose at least" hint="0 = optional, 1 = required">
            <input
              type="number"
              min={0}
              max={20}
              value={draft.min_select}
              onChange={(e) => setDraft({ ...draft, min_select: Number(e.target.value) })}
              className={inputClass}
            />
          </Labeled>
          <Labeled label="…and at most">
            <input
              type="number"
              min={1}
              max={20}
              value={draft.max_select}
              onChange={(e) => setDraft({ ...draft, max_select: Number(e.target.value) })}
              className={inputClass}
            />
          </Labeled>
        </div>
        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-bold">Options</legend>
          {options.map((o, i) => (
            <div
              key={i}
              className="bg-soft grid gap-2 rounded-lg p-3 sm:grid-cols-[1fr_1fr_1fr_110px]"
            >
              {(['en', 'ka', 'ru'] as const).map((l) => (
                <Labeled key={l} label={`Name (${l})`}>
                  <input
                    value={o[`name_${l}`]}
                    onChange={(e) => setOption(i, { [`name_${l}`]: e.target.value })}
                    lang={l}
                    className={inputClass}
                  />
                </Labeled>
              ))}
              <Labeled label="Price change">
                <input
                  value={o.price}
                  onChange={(e) => setOption(i, { price: e.target.value })}
                  placeholder="+2.00"
                  className={inputClass}
                />
              </Labeled>
              <div className="flex flex-wrap items-center gap-x-4 sm:col-span-4">
                <Check
                  label="Chosen by default"
                  checked={o.is_default}
                  onChange={(e) => setOption(i, { is_default: e.target.checked })}
                />
                <Check
                  label="Available"
                  checked={o.is_available}
                  onChange={(e) => setOption(i, { is_available: e.target.checked })}
                />
                <button
                  type="button"
                  onClick={() => setOptions((list) => list.filter((_, j) => j !== i))}
                  className="text-danger ml-auto min-h-11 rounded-md px-3 text-sm font-semibold"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setOptions((list) => [
                ...list,
                {
                  slug: '',
                  name_en: '',
                  name_ka: '',
                  name_ru: '',
                  price: '0',
                  is_default: false,
                  is_available: true,
                },
              ])
            }
            className="border-line-strong min-h-11 rounded-md border-2 border-dashed font-semibold"
          >
            + Add option
          </button>
        </fieldset>
        <FormMessage state={state} />
        <div className="flex flex-wrap justify-between gap-2">
          {group && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                window.confirm('Delete this option group? Dishes will no longer show it.') &&
                start(async () => {
                  const r = await deleteGroup(group.id);
                  setState(r);
                  if (r.ok) onClose();
                })
              }
              className="text-danger min-h-12 rounded-md px-4 font-semibold"
            >
              Delete group
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="bg-ink ml-auto min-h-12 rounded-md px-5 font-semibold text-white disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Save options'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

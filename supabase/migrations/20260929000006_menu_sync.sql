-- Applying a menu snapshot (from the Google Sheet, or the seed) in one transaction.
-- If anything fails, nothing changes and the site keeps the last good menu.

alter table public.restaurant_settings
  add column sheet_managed_fields text[] not null default '{}';

comment on column public.restaurant_settings.sheet_managed_fields is
  'Settings currently controlled by the Google Sheet "Settings" tab (read-only in admin).';

alter table public.closures
  add column source text not null default 'admin' check (source in ('admin', 'sheet'));

alter table public.opening_hours
  add column source text not null default 'admin' check (source in ('admin', 'sheet'));

/*
  p_snapshot shape (built and validated in src/lib/sheet/):
  {
    "categories": [{ "slug", "name", "blurb", "sort_order", "is_visible" }],
    "groups": null | [{ "slug", "name", "min_select", "max_select", "sort_order",
                 "options": [{ "slug", "name", "price_delta_tetri", "is_default", "is_available", "sort_order" }] }],
                             -- null = leave modifier groups and dish links untouched
    "items": [{ "slug", "category_slug", "name", "description", "price_tetri", "photo_path" (null = keep),
                "is_veg", "spice_level", "allergens", "is_popular", "is_available", "is_visible",
                "sort_order", "group_slugs": [] }],
    "keep_item_slugs": [],   -- rows that failed validation: leave those items exactly as they are
    "hours": null | [{ "weekday", "opens_at", "closes_at" }],
    "closures": null | [{ "starts_on", "ends_on", "note" }],
    "settings": null | { "<column>": value, ... },
    "prune": true            -- hide items / categories missing from the snapshot
  }
*/
create or replace function public.apply_menu_snapshot(p_snapshot jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_group jsonb;
  v_option jsonb;
  v_group_id uuid;
  v_item_id uuid;
  v_category_id uuid;
  v_keep text[] := coalesce(array(select jsonb_array_elements_text(p_snapshot -> 'keep_item_slugs')), '{}');
  v_item_slugs text[] := '{}';
  v_category_slugs text[] := '{}';
  v_group_slugs text[] := '{}';
  v_hidden_items integer := 0;
  v_settings jsonb := p_snapshot -> 'settings';
  v_allowed_settings text[] := array[
    'delivery_fee_tetri', 'free_delivery_over_tetri', 'min_delivery_order_tetri',
    'prep_minutes_pickup', 'prep_minutes_delivery', 'orders_paused',
    'delivery_enabled', 'pickup_enabled', 'signature_item_slugs', 'google_review_url'
  ];
  v_key text;
  v_manage_groups boolean := jsonb_typeof(p_snapshot -> 'groups') = 'array';
begin
  -- Categories ---------------------------------------------------------------
  for v_item in select * from jsonb_array_elements(coalesce(p_snapshot -> 'categories', '[]'::jsonb)) loop
    insert into public.categories (slug, name, blurb, sort_order, is_visible)
    values (
      v_item ->> 'slug', v_item -> 'name', coalesce(v_item -> 'blurb', '{}'::jsonb),
      coalesce((v_item ->> 'sort_order')::int, 0), coalesce((v_item ->> 'is_visible')::boolean, true)
    )
    on conflict (slug) do update set
      name = excluded.name, blurb = excluded.blurb,
      sort_order = excluded.sort_order, is_visible = excluded.is_visible;
    v_category_slugs := v_category_slugs || (v_item ->> 'slug');
  end loop;

  -- Modifier groups and options ---------------------------------------------------
  for v_group in select * from jsonb_array_elements(case when v_manage_groups then p_snapshot -> 'groups' else '[]'::jsonb end) loop
    insert into public.modifier_groups (slug, name, min_select, max_select, sort_order)
    values (
      v_group ->> 'slug', v_group -> 'name', (v_group ->> 'min_select')::smallint,
      (v_group ->> 'max_select')::smallint, coalesce((v_group ->> 'sort_order')::int, 0)
    )
    on conflict (slug) do update set
      name = excluded.name, min_select = excluded.min_select,
      max_select = excluded.max_select, sort_order = excluded.sort_order
    returning id into v_group_id;
    v_group_slugs := v_group_slugs || (v_group ->> 'slug');

    for v_option in select * from jsonb_array_elements(coalesce(v_group -> 'options', '[]'::jsonb)) loop
      insert into public.modifier_options (group_id, slug, name, price_delta_tetri, is_default, is_available, sort_order)
      values (
        v_group_id, v_option ->> 'slug', v_option -> 'name',
        coalesce((v_option ->> 'price_delta_tetri')::int, 0),
        coalesce((v_option ->> 'is_default')::boolean, false),
        coalesce((v_option ->> 'is_available')::boolean, true),
        coalesce((v_option ->> 'sort_order')::int, 0)
      )
      on conflict (group_id, slug) do update set
        name = excluded.name, price_delta_tetri = excluded.price_delta_tetri,
        is_default = excluded.is_default, is_available = excluded.is_available,
        sort_order = excluded.sort_order;
    end loop;

    -- Options removed from the sheet. Old orders keep their own snapshot, so deleting is safe.
    delete from public.modifier_options o
    where o.group_id = v_group_id
      and not exists (
        select 1 from jsonb_array_elements(coalesce(v_group -> 'options', '[]'::jsonb)) x
        where x ->> 'slug' = o.slug
      );
  end loop;

  -- Items -----------------------------------------------------------------------
  for v_item in select * from jsonb_array_elements(coalesce(p_snapshot -> 'items', '[]'::jsonb)) loop
    select id into v_category_id from public.categories where slug = v_item ->> 'category_slug';
    if v_category_id is null then
      raise exception 'Unknown category "%" for item "%"', v_item ->> 'category_slug', v_item ->> 'slug';
    end if;

    insert into public.menu_items (
      slug, category_id, name, description, price_tetri, photo_path, is_veg, spice_level,
      allergens, is_popular, is_available, is_visible, sort_order
    )
    values (
      v_item ->> 'slug', v_category_id, v_item -> 'name', coalesce(v_item -> 'description', '{}'::jsonb),
      (v_item ->> 'price_tetri')::int, v_item ->> 'photo_path',
      coalesce((v_item ->> 'is_veg')::boolean, false), (v_item ->> 'spice_level')::smallint,
      coalesce(array(select jsonb_array_elements_text(v_item -> 'allergens')), '{}'),
      coalesce((v_item ->> 'is_popular')::boolean, false),
      coalesce((v_item ->> 'is_available')::boolean, true),
      coalesce((v_item ->> 'is_visible')::boolean, true),
      coalesce((v_item ->> 'sort_order')::int, 0)
    )
    on conflict (slug) do update set
      category_id = excluded.category_id, name = excluded.name, description = excluded.description,
      price_tetri = excluded.price_tetri,
      -- An empty photo cell keeps whatever was uploaded in the admin panel.
      photo_path = coalesce(excluded.photo_path, public.menu_items.photo_path),
      is_veg = excluded.is_veg, spice_level = excluded.spice_level, allergens = excluded.allergens,
      is_popular = excluded.is_popular, is_available = excluded.is_available,
      is_visible = excluded.is_visible, sort_order = excluded.sort_order
    returning id into v_item_id;
    v_item_slugs := v_item_slugs || (v_item ->> 'slug');

    -- Link a photo uploaded as items/<slug>.webp when the sheet doesn't name one.
    update public.menu_items m set photo_path = o.name
    from storage.objects o
    where m.id = v_item_id and m.photo_path is null
      and o.bucket_id = 'menu-images' and o.name = 'items/' || m.slug || '.webp';

    if v_manage_groups then
      delete from public.item_modifier_groups where item_id = v_item_id;
      insert into public.item_modifier_groups (item_id, group_id, sort_order)
      select v_item_id, g.id, x.ord::int
      from jsonb_array_elements_text(coalesce(v_item -> 'group_slugs', '[]'::jsonb)) with ordinality as x (slug, ord)
      join public.modifier_groups g on g.slug = x.slug;
    end if;
  end loop;

  if coalesce((p_snapshot ->> 'prune')::boolean, true) then
    -- Items missing from the sheet are hidden, not deleted, so past orders keep their link.
    update public.menu_items set is_visible = false
    where is_visible and not (slug = any (v_item_slugs)) and not (slug = any (v_keep));
    get diagnostics v_hidden_items = row_count;

    update public.categories c set is_visible = false
    where c.is_visible and not (c.slug = any (v_category_slugs))
      and not exists (select 1 from public.menu_items m where m.category_id = c.id and m.is_visible);

    if v_manage_groups then
      delete from public.modifier_groups where not (slug = any (v_group_slugs));
    end if;
  end if;

  -- Opening hours and closures (only when the sheet has an Hours tab) -------------------
  if jsonb_typeof(p_snapshot -> 'hours') = 'array' then
    delete from public.opening_hours;
    insert into public.opening_hours (weekday, opens_at, closes_at, source)
    select (h ->> 'weekday')::smallint, (h ->> 'opens_at')::time, (h ->> 'closes_at')::time, 'sheet'
    from jsonb_array_elements(p_snapshot -> 'hours') h;
  end if;

  if jsonb_typeof(p_snapshot -> 'closures') = 'array' then
    delete from public.closures where source = 'sheet';
    insert into public.closures (starts_on, ends_on, note, source)
    select (c ->> 'starts_on')::date, (c ->> 'ends_on')::date, coalesce(c -> 'note', '{}'::jsonb), 'sheet'
    from jsonb_array_elements(p_snapshot -> 'closures') c;
  end if;

  -- Settings (only keys the sheet provides) ----------------------------------------------
  if jsonb_typeof(v_settings) = 'object' then
    for v_key in select jsonb_object_keys(v_settings) loop
      if not (v_key = any (v_allowed_settings)) then
        raise exception 'Setting "%" cannot be set from the sheet', v_key;
      end if;
    end loop;

    update public.restaurant_settings set
      delivery_fee_tetri = coalesce((v_settings ->> 'delivery_fee_tetri')::int, delivery_fee_tetri),
      free_delivery_over_tetri = coalesce((v_settings ->> 'free_delivery_over_tetri')::int, free_delivery_over_tetri),
      min_delivery_order_tetri = coalesce((v_settings ->> 'min_delivery_order_tetri')::int, min_delivery_order_tetri),
      prep_minutes_pickup = coalesce((v_settings ->> 'prep_minutes_pickup')::smallint, prep_minutes_pickup),
      prep_minutes_delivery = coalesce((v_settings ->> 'prep_minutes_delivery')::smallint, prep_minutes_delivery),
      orders_paused = coalesce((v_settings ->> 'orders_paused')::boolean, orders_paused),
      delivery_enabled = coalesce((v_settings ->> 'delivery_enabled')::boolean, delivery_enabled),
      pickup_enabled = coalesce((v_settings ->> 'pickup_enabled')::boolean, pickup_enabled),
      signature_item_slugs = coalesce(
        case when v_settings ? 'signature_item_slugs'
          then array(select jsonb_array_elements_text(v_settings -> 'signature_item_slugs')) end,
        signature_item_slugs),
      google_review_url = case when v_settings ? 'google_review_url'
        then nullif(v_settings ->> 'google_review_url', '') else google_review_url end,
      sheet_managed_fields = array(select jsonb_object_keys(v_settings))
    where id = 1;
  end if;

  return jsonb_build_object(
    'categories', coalesce(array_length(v_category_slugs, 1), 0),
    'items', coalesce(array_length(v_item_slugs, 1), 0),
    'groups', coalesce(array_length(v_group_slugs, 1), 0),
    'hidden_items', v_hidden_items,
    'kept_items', coalesce(array_length(v_keep, 1), 0)
  );
end;
$$;

revoke execute on function public.apply_menu_snapshot(jsonb) from public, anon, authenticated;

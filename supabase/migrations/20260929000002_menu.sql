-- Menu: categories, items and modifier groups.
-- Money is always integer tetri (1 GEL = 100 tetri).

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name jsonb not null check (public.is_i18n_text(name)),
  blurb jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category_id uuid not null references public.categories (id) on delete restrict,
  name jsonb not null check (public.is_i18n_text(name)),
  description jsonb not null default '{}'::jsonb,
  price_tetri integer not null check (price_tetri between 0 and 10000000),
  -- Path inside the "menu-images" storage bucket, e.g. "items/chicken-biryani.webp".
  photo_path text,
  is_veg boolean not null default false,
  -- 0 = not spicy, 1 = mild, 2 = medium, 3 = hot. Null = not stated.
  spice_level smallint check (spice_level between 0 and 3),
  allergens text[] not null default '{}',
  is_popular boolean not null default false,
  -- Set by the menu source (Google Sheet "sold" column or the admin editor).
  is_available boolean not null default true,
  -- Quick "sold out" switch from the kitchen. Clears itself once this time passes.
  sold_out_until timestamptz,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index menu_items_category_idx on public.menu_items (category_id, sort_order);

create table public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name jsonb not null check (public.is_i18n_text(name)),
  -- min_select > 0 makes the group required.
  min_select smallint not null default 0 check (min_select >= 0),
  max_select smallint not null default 1 check (max_select >= 1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_select <= max_select)
);

create table public.modifier_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.modifier_groups (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name jsonb not null check (public.is_i18n_text(name)),
  -- Added to the item price when chosen. May be negative (e.g. "half portion").
  price_delta_tetri integer not null default 0 check (price_delta_tetri between -10000000 and 10000000),
  is_default boolean not null default false,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, slug)
);

create table public.item_modifier_groups (
  item_id uuid not null references public.menu_items (id) on delete cascade,
  group_id uuid not null references public.modifier_groups (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (item_id, group_id)
);

create index item_modifier_groups_group_idx on public.item_modifier_groups (group_id);

create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger menu_items_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();
create trigger modifier_groups_updated_at before update on public.modifier_groups
  for each row execute function public.set_updated_at();
create trigger modifier_options_updated_at before update on public.modifier_options
  for each row execute function public.set_updated_at();

-- Staff may mark a dish sold out during service without full menu rights.
create or replace function public.set_item_sold_out(p_item_id uuid, p_until timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.menu_items set sold_out_until = p_until where id = p_item_id;
end;
$$;

revoke execute on function public.set_item_sold_out(uuid, timestamptz) from public, anon;
grant execute on function public.set_item_sold_out(uuid, timestamptz) to authenticated;

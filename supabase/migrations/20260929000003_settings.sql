-- Restaurant settings, opening hours, closures and delivery zones.

create type public.menu_source as enum ('sheet', 'admin');

-- Single-row table (id is always 1). Everything here is safe to show publicly.
create table public.restaurant_settings (
  id smallint primary key default 1 check (id = 1),
  timezone text not null default 'Asia/Tbilisi',
  phone text not null default '+995500904721',
  whatsapp text not null default '995500904721' check (whatsapp ~ '^[0-9]{8,15}$'),
  -- 7 Sherif Khimshiashvili St (OpenStreetMap). Owner should confirm the exact pin.
  latitude double precision not null default 41.641,
  longitude double precision not null default 41.6151,
  -- Fees and limits (tetri). 0 = off.
  delivery_fee_tetri integer not null default 0 check (delivery_fee_tetri >= 0),
  free_delivery_over_tetri integer not null default 0 check (free_delivery_over_tetri >= 0),
  min_delivery_order_tetri integer not null default 0 check (min_delivery_order_tetri >= 0),
  -- Default kitchen times (minutes) used for estimates before staff set a prep time.
  prep_minutes_pickup smallint not null default 30 check (prep_minutes_pickup between 5 and 240),
  prep_minutes_delivery smallint not null default 45 check (prep_minutes_delivery between 5 and 240),
  slot_interval_minutes smallint not null default 15 check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
  schedule_days_ahead smallint not null default 2 check (schedule_days_ahead between 0 and 14),
  -- Stop taking orders for this many minutes before closing.
  last_order_minutes_before_close smallint not null default 15 check (last_order_minutes_before_close between 0 and 120),
  delivery_enabled boolean not null default true,
  pickup_enabled boolean not null default true,
  -- "Pause online orders" switch. The menu stays visible; checkout is blocked.
  orders_paused boolean not null default false,
  pause_message jsonb not null default '{}'::jsonb,
  menu_source public.menu_source not null default 'sheet',
  signature_item_slugs text[] not null default '{}',
  google_review_url text,
  owner_name text,
  owner_note jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger restaurant_settings_updated_at before update on public.restaurant_settings
  for each row execute function public.set_updated_at();

insert into public.restaurant_settings (id) values (1);

-- Private settings (staff only). Published Sheet links are not secret, but there is
-- no reason to hand them to the public either.
create table public.integration_settings (
  id smallint primary key default 1 check (id = 1),
  sheet_categories_csv_url text,
  sheet_menu_csv_url text,
  sheet_options_csv_url text,
  sheet_hours_csv_url text,
  sheet_settings_csv_url text,
  sheet_refresh_minutes smallint not null default 5 check (sheet_refresh_minutes between 1 and 1440),
  updated_at timestamptz not null default now()
);

create trigger integration_settings_updated_at before update on public.integration_settings
  for each row execute function public.set_updated_at();

insert into public.integration_settings (id) values (1);

-- Weekly hours. weekday: 1 = Monday ... 7 = Sunday (ISO).
-- A day may have several ranges (e.g. lunch and dinner). If closes_at is earlier than
-- opens_at the range runs past midnight (12:00 -> 01:00). 00:00 as closes_at = midnight.
create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 1 and 7),
  opens_at time not null,
  closes_at time not null,
  check (opens_at <> closes_at)
);

create index opening_hours_weekday_idx on public.opening_hours (weekday, opens_at);

-- Holiday closures: whole days, inclusive.
create table public.closures (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null,
  ends_on date not null,
  note jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create type public.zone_kind as enum ('radius', 'polygon');

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  kind public.zone_kind not null default 'radius',
  -- For radius zones: distance from the restaurant in km.
  radius_km numeric(5, 2) check (radius_km > 0 and radius_km <= 100),
  -- For polygon zones: [[lat, lng], [lat, lng], ...] (at least 3 points).
  polygon jsonb,
  -- Null = use the default fee / minimum from restaurant_settings.
  fee_tetri integer check (fee_tetri >= 0),
  min_order_tetri integer check (min_order_tetri >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    (kind = 'radius' and radius_km is not null)
    or (kind = 'polygon' and jsonb_typeof(polygon) = 'array' and jsonb_array_length(polygon) >= 3)
  )
);

-- Log of Google Sheet imports, shown in the admin panel.
create table public.sheet_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'unchanged', 'error')),
  trigger text not null default 'schedule' check (trigger in ('schedule', 'manual', 'cli')),
  content_hash text,
  summary jsonb not null default '{}'::jsonb,
  problems jsonb not null default '[]'::jsonb
);

create index sheet_sync_runs_started_idx on public.sheet_sync_runs (started_at desc);

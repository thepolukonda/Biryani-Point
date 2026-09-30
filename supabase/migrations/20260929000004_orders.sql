-- Orders. Created only by the server (service role) after it has recalculated every price.

create type public.order_type as enum ('delivery', 'pickup');
create type public.order_status as enum (
  'received', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed', 'rejected', 'cancelled'
);
create type public.payment_method as enum ('cash', 'pay_at_pickup', 'online');
create type public.payment_status as enum ('unpaid', 'pending', 'paid', 'failed', 'refunded');

-- Human-friendly order numbers: BP-1001, BP-1002, ...
create sequence public.order_number_seq start with 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number integer not null unique default nextval('public.order_number_seq'),
  -- Unguessable id used in the public tracking URL /order/<public_id>.
  public_id text not null unique check (public_id ~ '^[A-Za-z0-9_-]{20,40}$'),
  -- Sent by the browser once per checkout attempt; a retry returns the same order.
  idempotency_key text unique check (length(idempotency_key) between 16 and 100),
  request_hash text not null,

  status public.order_status not null default 'received',
  type public.order_type not null,

  customer_name text not null check (length(trim(customer_name)) between 1 and 80),
  customer_phone text not null check (customer_phone ~ '^\+995[0-9]{9}$'),
  customer_locale text not null default 'en' check (customer_locale in ('en', 'ka', 'ru')),

  address_text text check (length(address_text) <= 300),
  address_lat double precision check (address_lat between -90 and 90),
  address_lng double precision check (address_lng between -180 and 180),
  delivery_zone_id uuid references public.delivery_zones (id) on delete set null,
  distance_km numeric(6, 2),

  -- Null = as soon as possible.
  scheduled_for timestamptz,
  prep_minutes smallint check (prep_minutes between 1 and 480),
  estimated_ready_at timestamptz,
  notes text check (length(notes) <= 500),

  subtotal_tetri integer not null check (subtotal_tetri >= 0),
  delivery_fee_tetri integer not null default 0 check (delivery_fee_tetri >= 0),
  discount_tetri integer not null default 0 check (discount_tetri >= 0),
  total_tetri integer not null check (total_tetri >= 0),

  payment_method public.payment_method not null default 'cash',
  payment_status public.payment_status not null default 'unpaid',
  payment_provider text,

  rejection_reason text check (length(rejection_reason) <= 300),
  accepted_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  rejected_at timestamptz,

  -- Salted hash of the client IP, kept only for abuse investigation.
  client_ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (total_tetri = subtotal_tetri + delivery_fee_tetri - discount_tetri),
  check (type = 'pickup' or address_text is not null or address_lat is not null),
  check (status <> 'rejected' or rejection_reason is not null)
);

create index orders_created_idx on public.orders (created_at desc);
create index orders_active_idx on public.orders (status, created_at)
  where status not in ('completed', 'rejected', 'cancelled');

create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  item_slug text not null,
  -- Snapshot of the name at order time, so later menu edits don't rewrite history.
  item_name jsonb not null check (public.is_i18n_text(item_name)),
  base_price_tetri integer not null check (base_price_tetri >= 0),
  -- base price + chosen modifier deltas, for one unit.
  unit_price_tetri integer not null check (unit_price_tetri >= 0),
  quantity smallint not null check (quantity between 1 and 50),
  line_total_tetri integer not null check (line_total_tetri >= 0),
  -- [{ "group": {...i18n}, "option": {...i18n}, "group_slug": "...", "option_slug": "...", "price_delta_tetri": 200 }]
  modifiers jsonb not null default '[]'::jsonb check (jsonb_typeof(modifiers) = 'array'),
  notes text check (length(notes) <= 200),
  sort_order smallint not null default 0,
  check (line_total_tetri = unit_price_tetri * quantity)
);

create index order_items_order_idx on public.order_items (order_id);

-- Status history for the tracking timeline and reports.
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  note text,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, created_at);

-- Allowed status moves. Anything else is refused by the database, not only the UI.
create or replace function public.order_status_allowed(old_status public.order_status, new_status public.order_status)
returns boolean
language sql
immutable
as $$
  select case old_status
    when 'received'         then new_status in ('accepted', 'rejected', 'cancelled')
    when 'accepted'         then new_status in ('preparing', 'ready', 'out_for_delivery', 'cancelled')
    when 'preparing'        then new_status in ('ready', 'out_for_delivery', 'cancelled')
    when 'ready'            then new_status in ('out_for_delivery', 'completed', 'cancelled')
    when 'out_for_delivery' then new_status in ('completed', 'cancelled')
    else false
  end
$$;

create or replace function public.orders_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if not public.order_status_allowed(old.status, new.status) then
      raise exception 'Order % cannot move from % to %', old.order_number, old.status, new.status
        using errcode = '23514';
    end if;
    case new.status
      when 'accepted' then new.accepted_at = coalesce(new.accepted_at, now());
      when 'ready' then new.ready_at = coalesce(new.ready_at, now());
      when 'out_for_delivery' then new.ready_at = coalesce(new.ready_at, now());
      when 'completed' then new.completed_at = coalesce(new.completed_at, now());
      when 'rejected' then new.rejected_at = coalesce(new.rejected_at, now());
      else null;
    end case;
    insert into public.order_events (order_id, status, note, actor_id)
    values (new.id, new.status, case when new.status = 'rejected' then new.rejection_reason end, (select auth.uid()));
  end if;
  return new;
end;
$$;

create trigger orders_status_before_update before update on public.orders
  for each row execute function public.orders_on_status_change();

-- The INSERT event row needs the order id to exist, so it runs after insert.
create or replace function public.orders_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_events (order_id, status) values (new.id, new.status);
  return null;
end;
$$;

create trigger orders_status_after_insert after insert on public.orders
  for each row execute function public.orders_after_insert();

-- Public, read-only view of one order for the tracking page. No phone, address or IP.
create or replace function public.get_public_order(p_public_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'public_id', o.public_id,
    'order_number', o.order_number,
    'status', o.status,
    'type', o.type,
    'customer_first_name', split_part(trim(o.customer_name), ' ', 1),
    'scheduled_for', o.scheduled_for,
    'estimated_ready_at', o.estimated_ready_at,
    'prep_minutes', o.prep_minutes,
    'subtotal_tetri', o.subtotal_tetri,
    'delivery_fee_tetri', o.delivery_fee_tetri,
    'discount_tetri', o.discount_tetri,
    'total_tetri', o.total_tetri,
    'payment_method', o.payment_method,
    'payment_status', o.payment_status,
    'rejection_reason', o.rejection_reason,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.item_name,
        'quantity', i.quantity,
        'unit_price_tetri', i.unit_price_tetri,
        'line_total_tetri', i.line_total_tetri,
        'modifiers', i.modifiers,
        'notes', i.notes
      ) order by i.sort_order)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('status', e.status, 'at', e.created_at) order by e.created_at)
      from public.order_events e where e.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.public_id = p_public_id
$$;

revoke execute on function public.get_public_order(text) from public;
grant execute on function public.get_public_order(text) to anon, authenticated;

-- Live tracking: broadcast status changes on a channel named after the unguessable
-- public id. The payload carries no personal data.
create or replace function public.orders_broadcast_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     or new.estimated_ready_at is distinct from old.estimated_ready_at
     or new.payment_status is distinct from old.payment_status then
    perform realtime.send(
      jsonb_build_object(
        'status', new.status,
        'estimated_ready_at', new.estimated_ready_at,
        'prep_minutes', new.prep_minutes,
        'payment_status', new.payment_status,
        'rejection_reason', new.rejection_reason,
        'updated_at', new.updated_at
      ),
      'status',
      'order:' || new.public_id,
      false
    );
  end if;
  return null;
end;
$$;

create trigger orders_broadcast_after_update after update on public.orders
  for each row execute function public.orders_broadcast_status();

-- ---------------------------------------------------------------------------
-- Payments (for a future Bank of Georgia / TBC gateway). Nothing uses these yet.
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null,
  provider_payment_id text,
  amount_tetri integer not null check (amount_tetri >= 0),
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- Every webhook is stored once, so a provider retrying the same event is harmless.
create table public.payment_webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_id text not null,
  payload jsonb not null,
  processed_at timestamptz,
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window). Called by the server with the service role.
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

create or replace function public.rate_limit_hit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  -- Opportunistic clean-up of old windows.
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_max;
end;
$$;

revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;

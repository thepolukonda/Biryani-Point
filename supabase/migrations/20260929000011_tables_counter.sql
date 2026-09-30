-- Tables (dine-in) and orders taken at the counter by staff: table tabs and takeaway.
--
-- A table has at most one open order (its "tab"). Staff add dishes in rounds; each round
-- is printed as its own KOT (order_items.kot_round), and the tab is closed when the guests
-- pay. Counter orders are priced by the server exactly like website orders.

-- Tables ------------------------------------------------------------------------------
create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 40),
  seats smallint not null default 4 check (seats between 1 and 50),
  -- Optional grouping, e.g. "Terrace".
  area text check (length(area) <= 40),
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index dining_tables_name_key on public.dining_tables (lower(trim(name)));

create trigger dining_tables_updated_at before update on public.dining_tables
  for each row execute function public.set_updated_at();

alter table public.dining_tables enable row level security;

create policy "staff reads tables" on public.dining_tables
  for select to authenticated using (public.is_staff());
create policy "owner adds tables" on public.dining_tables
  for insert to authenticated with check (public.is_owner());
create policy "owner updates tables" on public.dining_tables
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "owner removes tables" on public.dining_tables
  for delete to authenticated using (public.is_owner());

-- Orders ------------------------------------------------------------------------------
alter table public.orders
  add column source public.order_source not null default 'website',
  add column table_id uuid references public.dining_tables (id) on delete set null,
  -- The table's name when the order was taken, kept if the table is later removed.
  add column table_label text check (length(table_label) <= 40),
  -- Number of KOT rounds so far (1 = the first dishes).
  add column kot_round smallint not null default 1 check (kot_round between 1 and 99),
  add column created_by uuid references auth.users (id) on delete set null;

-- Counter orders may have no name (takeaway without a name) and no phone.
alter table public.orders drop constraint orders_customer_name_check;
alter table public.orders add constraint orders_customer_name_check
  check (length(trim(customer_name)) <= 80
    and (source = 'counter' or length(trim(customer_name)) >= 1));
alter table public.orders drop constraint orders_customer_phone_check;
alter table public.orders add constraint orders_customer_phone_check
  check (customer_phone ~ '^\+995[0-9]{9}$' or (source = 'counter' and customer_phone = ''));

-- Only delivery orders need an address.
alter table public.orders drop constraint orders_check1;
alter table public.orders add constraint orders_delivery_address_check
  check (type <> 'delivery' or address_text is not null or address_lat is not null);
-- The counter takes table and takeaway orders, not deliveries.
alter table public.orders add constraint orders_counter_type_check
  check (source = 'website' or type <> 'delivery');
-- Table orders always say which table.
alter table public.orders add constraint orders_dine_in_table_check
  check (type::text <> 'dine_in' or table_label is not null);

-- One open tab per table.
create unique index orders_one_open_per_table on public.orders (table_id)
  where table_id is not null
    and status in ('received', 'accepted', 'preparing', 'ready', 'out_for_delivery');

alter table public.order_items
  add column kot_round smallint not null default 1 check (kot_round between 1 and 99);

-- Staff settle a bill as cash or card.
grant update (payment_method) on public.orders to authenticated;

-- Status moves: a table tab can be closed from any open state, and goes back to
-- "preparing" when more dishes are added after it was served ("ready").
create or replace function public.order_status_allowed(old_status public.order_status, new_status public.order_status)
returns boolean
language sql
immutable
as $$
  select case old_status
    when 'received'         then new_status in ('accepted', 'rejected', 'cancelled')
    when 'accepted'         then new_status in ('preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled')
    when 'preparing'        then new_status in ('ready', 'out_for_delivery', 'completed', 'cancelled')
    when 'ready'            then new_status in ('preparing', 'out_for_delivery', 'completed', 'cancelled')
    when 'out_for_delivery' then new_status in ('completed', 'cancelled')
    else false
  end
$$;

-- Prints: each KOT round has its own copy numbers.
alter table public.order_prints add column round smallint not null default 1 check (round >= 1);
alter table public.order_prints drop constraint order_prints_order_id_kind_copy_no_key;
alter table public.order_prints add constraint order_prints_unique_copy
  unique (order_id, kind, round, copy_no);

drop function public.claim_print(uuid, text, boolean);

/**
 * Records a print and returns its copy number (1 = first print).
 * p_round: which KOT round (bills always use 1).
 * p_first_only: used by auto-print. Returns null (and records nothing) if this ticket was
 * already printed, so two kitchen devices never both print the same ticket.
 */
create or replace function public.claim_print(
  p_order_id uuid,
  p_kind text,
  p_first_only boolean default false,
  p_round smallint default 1
)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next smallint;
  v_round smallint := case when p_kind = 'kot' then greatest(coalesce(p_round, 1), 1) else 1 end;
begin
  if not public.is_staff() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_kind not in ('kot', 'bill') then
    raise exception 'unknown ticket %', p_kind;
  end if;

  -- Serialise prints of the same order so the copy numbers can't collide.
  perform 1 from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found';
  end if;

  select coalesce(max(copy_no), 0) + 1 into v_next
  from public.order_prints
  where order_id = p_order_id and kind = p_kind and round = v_round;

  if p_first_only and v_next > 1 then
    return null;
  end if;

  insert into public.order_prints (order_id, kind, round, copy_no, printed_by)
  values (p_order_id, p_kind, v_round, v_next, auth.uid());
  return v_next;
end;
$$;

revoke all on function public.claim_print(uuid, text, boolean, smallint) from public, anon;
grant execute on function public.claim_print(uuid, text, boolean, smallint) to authenticated;

-- Counter orders ----------------------------------------------------------------------
-- Both functions are called only by the server (service role) after it has checked the
-- staff member and priced the dishes from the live menu.

create or replace function public.insert_order_items(p_order_id uuid, p_items jsonb, p_round smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_index integer;
begin
  select coalesce(max(sort_order) + 1, 0) into v_index from public.order_items where order_id = p_order_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.order_items (
      order_id, menu_item_id, item_slug, item_name, base_price_tetri, unit_price_tetri,
      quantity, line_total_tetri, modifiers, notes, sort_order, kot_round
    )
    values (
      p_order_id,
      (select id from public.menu_items where slug = v_item ->> 'item_slug'),
      v_item ->> 'item_slug',
      v_item -> 'item_name',
      (v_item ->> 'base_price_tetri')::integer,
      (v_item ->> 'unit_price_tetri')::integer,
      (v_item ->> 'quantity')::smallint,
      (v_item ->> 'line_total_tetri')::integer,
      coalesce(v_item -> 'modifiers', '[]'::jsonb),
      v_item ->> 'notes',
      v_index,
      p_round
    );
    v_index := v_index + 1;
  end loop;
end;
$$;

revoke execute on function public.insert_order_items(uuid, jsonb, smallint) from public, anon, authenticated;

/**
 * A table or takeaway order taken by staff. It starts as accepted (the kitchen doesn't
 * need to accept its own orders), so the KOT prints straight away.
 * Returns {id, order_number, duplicate} or raises 'table_busy' if the table already has
 * an open tab.
 */
create or replace function public.create_counter_order(p_order jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.orders%rowtype;
  v_order public.orders%rowtype;
  v_table public.dining_tables%rowtype;
begin
  select * into v_existing from public.orders where idempotency_key = p_order ->> 'idempotency_key';
  if found then
    return jsonb_build_object('duplicate', true, 'id', v_existing.id, 'order_number', v_existing.order_number);
  end if;

  if p_order ->> 'type' = 'dine_in' then
    select * into v_table from public.dining_tables
    where id = (p_order ->> 'table_id')::uuid and is_active
    for update;
    if not found then
      raise exception 'table_not_found' using errcode = 'P0002';
    end if;
  end if;

  begin
    insert into public.orders (
      public_id, idempotency_key, request_hash, source, type, status,
      customer_name, customer_phone, customer_locale, table_id, table_label,
      prep_minutes, estimated_ready_at, accepted_at, notes,
      subtotal_tetri, delivery_fee_tetri, discount_tetri, total_tetri,
      payment_method, payment_status, created_by
    )
    values (
      p_order ->> 'public_id',
      p_order ->> 'idempotency_key',
      p_order ->> 'request_hash',
      'counter',
      (p_order ->> 'type')::public.order_type,
      'accepted',
      coalesce(p_order ->> 'customer_name', ''),
      '',
      coalesce(p_order ->> 'customer_locale', 'en'),
      v_table.id,
      v_table.name,
      (p_order ->> 'prep_minutes')::smallint,
      (p_order ->> 'estimated_ready_at')::timestamptz,
      now(),
      p_order ->> 'notes',
      (p_order ->> 'subtotal_tetri')::integer,
      0,
      0,
      (p_order ->> 'subtotal_tetri')::integer,
      (p_order ->> 'payment_method')::public.payment_method,
      (p_order ->> 'payment_status')::public.payment_status,
      (p_order ->> 'created_by')::uuid
    )
    returning * into v_order;
  exception when unique_violation then
    select * into v_existing from public.orders where idempotency_key = p_order ->> 'idempotency_key';
    if found then
      return jsonb_build_object('duplicate', true, 'id', v_existing.id, 'order_number', v_existing.order_number);
    end if;
    raise exception 'table_busy' using errcode = '23505';
  end;

  insert into public.order_events (order_id, status, actor_id)
  values (v_order.id, 'accepted', (p_order ->> 'created_by')::uuid);

  perform public.insert_order_items(v_order.id, p_items, 1::smallint);

  return jsonb_build_object('duplicate', false, 'id', v_order.id, 'order_number', v_order.order_number);
end;
$$;

revoke execute on function public.create_counter_order(jsonb, jsonb) from public, anon, authenticated;

/**
 * Adds a round of dishes to an open counter order (a table tab, or a takeaway not yet
 * handed over). Returns the new round number. A served table goes back to "preparing".
 */
create or replace function public.add_order_round(p_order_id uuid, p_items jsonb, p_subtotal_tetri integer)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_round smallint;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_order.source <> 'counter' or v_order.status not in ('accepted', 'preparing', 'ready') then
    raise exception 'order_closed' using errcode = '23514';
  end if;

  v_round := v_order.kot_round + 1;
  perform public.insert_order_items(p_order_id, p_items, v_round);

  update public.orders set
    kot_round = v_round,
    subtotal_tetri = subtotal_tetri + p_subtotal_tetri,
    total_tetri = total_tetri + p_subtotal_tetri,
    -- More to pay: a bill marked paid earlier no longer covers everything.
    payment_status = case when p_subtotal_tetri > 0 then 'unpaid'::public.payment_status else payment_status end,
    status = case when status = 'ready' then 'preparing'::public.order_status else status end
  where id = p_order_id;

  return v_round;
end;
$$;

revoke execute on function public.add_order_round(uuid, jsonb, integer) from public, anon, authenticated;

-- Reports: include where the order came from.
drop function public.report_orders(timestamptz, timestamptz);
create or replace function public.report_orders(p_from timestamptz, p_to timestamptz)
returns table (
  order_number integer,
  created_at timestamptz,
  local_day date,
  status public.order_status,
  type public.order_type,
  source public.order_source,
  total_tetri integer,
  subtotal_tetri integer,
  delivery_fee_tetri integer,
  payment_method public.payment_method,
  payment_status public.payment_status
)
language sql
stable
security invoker
set search_path = ''
as $$
  select o.order_number, o.created_at,
         (o.created_at at time zone (select timezone from public.restaurant_settings where id = 1))::date,
         o.status, o.type, o.source, o.total_tetri, o.subtotal_tetri, o.delivery_fee_tetri,
         o.payment_method, o.payment_status
  from public.orders o
  where o.created_at >= p_from and o.created_at < p_to
  order by o.created_at
$$;

grant execute on function public.report_orders(timestamptz, timestamptz) to authenticated;

-- The board shows free and busy tables live.
alter publication supabase_realtime add table public.dining_tables;

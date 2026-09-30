-- Order creation in one transaction: the order row and its items, or nothing.
-- Called only by the server (service role) after it has priced the order itself.
--
-- Idempotency: if an order with the same idempotency_key exists, it is returned
-- instead of creating a second one (a double tap or a retried request).

create or replace function public.create_order(p_order jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.orders%rowtype;
  v_order public.orders%rowtype;
  v_item jsonb;
  v_index integer := 0;
begin
  if p_order ->> 'idempotency_key' is not null then
    select * into v_existing from public.orders where idempotency_key = p_order ->> 'idempotency_key';
    if found then
      return jsonb_build_object(
        'duplicate', true,
        'same_request', v_existing.request_hash = p_order ->> 'request_hash',
        'id', v_existing.id,
        'public_id', v_existing.public_id,
        'order_number', v_existing.order_number
      );
    end if;
  end if;

  begin
    insert into public.orders (
      public_id, idempotency_key, request_hash, type, customer_name, customer_phone, customer_locale,
      address_text, address_lat, address_lng, delivery_zone_id, distance_km,
      scheduled_for, prep_minutes, estimated_ready_at, notes,
      subtotal_tetri, delivery_fee_tetri, discount_tetri, total_tetri,
      payment_method, payment_status, client_ip_hash
    )
    values (
      p_order ->> 'public_id',
      p_order ->> 'idempotency_key',
      p_order ->> 'request_hash',
      (p_order ->> 'type')::public.order_type,
      p_order ->> 'customer_name',
      p_order ->> 'customer_phone',
      coalesce(p_order ->> 'customer_locale', 'en'),
      p_order ->> 'address_text',
      (p_order ->> 'address_lat')::double precision,
      (p_order ->> 'address_lng')::double precision,
      (p_order ->> 'delivery_zone_id')::uuid,
      (p_order ->> 'distance_km')::numeric,
      (p_order ->> 'scheduled_for')::timestamptz,
      (p_order ->> 'prep_minutes')::smallint,
      (p_order ->> 'estimated_ready_at')::timestamptz,
      p_order ->> 'notes',
      (p_order ->> 'subtotal_tetri')::integer,
      (p_order ->> 'delivery_fee_tetri')::integer,
      coalesce((p_order ->> 'discount_tetri')::integer, 0),
      (p_order ->> 'total_tetri')::integer,
      (p_order ->> 'payment_method')::public.payment_method,
      'unpaid',
      p_order ->> 'client_ip_hash'
    )
    returning * into v_order;
  exception when unique_violation then
    -- Two identical requests raced; the other one won. Return it.
    select * into v_existing from public.orders where idempotency_key = p_order ->> 'idempotency_key';
    if found then
      return jsonb_build_object(
        'duplicate', true,
        'same_request', v_existing.request_hash = p_order ->> 'request_hash',
        'id', v_existing.id,
        'public_id', v_existing.public_id,
        'order_number', v_existing.order_number
      );
    end if;
    raise;
  end;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.order_items (
      order_id, menu_item_id, item_slug, item_name, base_price_tetri, unit_price_tetri,
      quantity, line_total_tetri, modifiers, notes, sort_order
    )
    values (
      v_order.id,
      (select id from public.menu_items where slug = v_item ->> 'item_slug'),
      v_item ->> 'item_slug',
      v_item -> 'item_name',
      (v_item ->> 'base_price_tetri')::integer,
      (v_item ->> 'unit_price_tetri')::integer,
      (v_item ->> 'quantity')::smallint,
      (v_item ->> 'line_total_tetri')::integer,
      coalesce(v_item -> 'modifiers', '[]'::jsonb),
      v_item ->> 'notes',
      v_index
    );
    v_index := v_index + 1;
  end loop;

  return jsonb_build_object(
    'duplicate', false,
    'same_request', true,
    'id', v_order.id,
    'public_id', v_order.public_id,
    'order_number', v_order.order_number
  );
end;
$$;

revoke execute on function public.create_order(jsonb, jsonb) from public, anon, authenticated;

-- Reports: one row per order in a date range, with its local (Tbilisi) day.
-- security invoker: RLS applies, so only staff can read; the app limits reports to owners.
create or replace function public.report_orders(p_from timestamptz, p_to timestamptz)
returns table (
  order_number integer,
  created_at timestamptz,
  local_day date,
  status public.order_status,
  type public.order_type,
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
         o.status, o.type, o.total_tetri, o.subtotal_tetri, o.delivery_fee_tetri,
         o.payment_method, o.payment_status
  from public.orders o
  where o.created_at >= p_from and o.created_at < p_to
  order by o.created_at
$$;

grant execute on function public.report_orders(timestamptz, timestamptz) to authenticated;

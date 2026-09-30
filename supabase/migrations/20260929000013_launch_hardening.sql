-- Launch hardening.

-- 1. Visitors with a foreign SIM can order: any E.164 number, not only +995.
alter table public.orders drop constraint orders_customer_phone_check;
alter table public.orders add constraint orders_customer_phone_check
  check (customer_phone ~ '^\+[1-9][0-9]{7,14}$' or (source = 'counter' and customer_phone = ''));

-- 2. Staff may only record the payment values the app itself uses. Refunds, failed and
--    online payments are set by the payment provider (service role) only.
create or replace function public.orders_payment_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.role()) = 'service_role' then
    return new;
  end if;

  if new.payment_status is distinct from old.payment_status
     and new.payment_status not in ('paid', 'unpaid') then
    raise exception 'payment_status_not_allowed: %', new.payment_status using errcode = '42501';
  end if;

  if new.payment_method is distinct from old.payment_method
     and new.payment_method not in ('cash', 'card', 'pay_at_pickup') then
    raise exception 'payment_method_not_allowed: %', new.payment_method using errcode = '42501';
  end if;

  if (new.payment_status is distinct from old.payment_status
      or new.payment_method is distinct from old.payment_method)
     and old.status not in ('accepted', 'preparing', 'ready', 'out_for_delivery') then
    raise exception 'payment_locked: order % is %, its payment cannot change', old.order_number, old.status
      using errcode = '23514';
  end if;

  if new.status = 'completed' and old.status is distinct from 'completed'
     and new.payment_status is distinct from 'paid' then
    raise exception 'not_paid: order % must be paid before it is completed', old.order_number
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- 3. Reports are for signed-in staff only (RLS already returns nothing to others).
revoke execute on function public.report_orders(timestamptz, timestamptz) from public, anon;

-- 4. The privacy policy promises the hashed IP is kept at most 30 days. Called by the
--    scheduled job (/api/cron/sheet-sync), which also keeps a free Supabase project awake.
create or replace function public.purge_expired_data()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.orders set client_ip_hash = null
   where client_ip_hash is not null and created_at < now() - interval '30 days';
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;

revoke execute on function public.purge_expired_data() from public, anon, authenticated;

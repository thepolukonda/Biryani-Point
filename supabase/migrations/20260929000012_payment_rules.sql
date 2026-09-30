-- Payment rules, enforced by the database and not only the admin screens:
--  * payment can only be changed while the order is live (accepted … out for delivery),
--    so not before it is accepted and never after it is completed, rejected or cancelled;
--  * an order can only be completed (picked up / delivered / table closed) once it is paid.
-- The service role (payment webhooks, refunds) is not limited by this.

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

-- Runs before orders_status_before_update (triggers fire in name order).
create trigger orders_payment_before_update before update on public.orders
  for each row execute function public.orders_payment_guard();

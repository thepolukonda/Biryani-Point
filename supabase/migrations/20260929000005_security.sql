-- Row Level Security on every table, realtime publication and storage policies.
--
-- Who can do what:
--   anon (customers)  read the visible menu, hours, zones and public settings.
--                     Read their own order only through get_public_order(public_id).
--   staff             everything above + read orders, update order status fields.
--   owner             everything.
--   service role      (server only) creates orders, runs the Sheet sync. Bypasses RLS.

alter table public.staff enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.modifier_groups enable row level security;
alter table public.modifier_options enable row level security;
alter table public.item_modifier_groups enable row level security;
alter table public.restaurant_settings enable row level security;
alter table public.integration_settings enable row level security;
alter table public.opening_hours enable row level security;
alter table public.closures enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.sheet_sync_runs enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.rate_limits enable row level security;

-- staff ----------------------------------------------------------------------
create policy "staff read self or owner reads all" on public.staff
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_owner());
create policy "owner manages staff" on public.staff
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- menu -----------------------------------------------------------------------
create policy "public reads visible categories" on public.categories
  for select to anon, authenticated
  using (is_visible or public.is_staff());
create policy "owner writes categories" on public.categories
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "public reads visible items" on public.menu_items
  for select to anon, authenticated
  using (is_visible or public.is_staff());
create policy "owner writes items" on public.menu_items
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "public reads modifier groups" on public.modifier_groups
  for select to anon, authenticated using (true);
create policy "owner writes modifier groups" on public.modifier_groups
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "public reads modifier options" on public.modifier_options
  for select to anon, authenticated using (true);
create policy "owner writes modifier options" on public.modifier_options
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "public reads item modifier links" on public.item_modifier_groups
  for select to anon, authenticated using (true);
create policy "owner writes item modifier links" on public.item_modifier_groups
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- settings, hours, zones -------------------------------------------------------
create policy "public reads settings" on public.restaurant_settings
  for select to anon, authenticated using (true);
create policy "owner updates settings" on public.restaurant_settings
  for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "owner reads integrations" on public.integration_settings
  for select to authenticated using (public.is_owner());
create policy "owner updates integrations" on public.integration_settings
  for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "public reads hours" on public.opening_hours
  for select to anon, authenticated using (true);
create policy "owner writes hours" on public.opening_hours
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "public reads closures" on public.closures
  for select to anon, authenticated using (true);
create policy "owner writes closures" on public.closures
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "public reads active zones" on public.delivery_zones
  for select to anon, authenticated
  using (is_active or public.is_staff());
create policy "owner writes zones" on public.delivery_zones
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "staff reads sync log" on public.sheet_sync_runs
  for select to authenticated using (public.is_staff());

-- orders -----------------------------------------------------------------------
-- No insert/delete policies: only the server (service role) creates orders.
create policy "staff reads orders" on public.orders
  for select to authenticated using (public.is_staff());
create policy "staff updates orders" on public.orders
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Staff may change the workflow fields only, never prices or customer details.
revoke insert, update, delete on public.orders from anon, authenticated;
grant update (status, prep_minutes, estimated_ready_at, rejection_reason, payment_status)
  on public.orders to authenticated;

create policy "staff reads order items" on public.order_items
  for select to authenticated using (public.is_staff());
revoke insert, update, delete on public.order_items from anon, authenticated;

create policy "staff reads order events" on public.order_events
  for select to authenticated using (public.is_staff());
revoke insert, update, delete on public.order_events from anon, authenticated;

create policy "owner reads payments" on public.payments
  for select to authenticated using (public.is_owner());
revoke insert, update, delete on public.payments from anon, authenticated;

create policy "owner reads webhook events" on public.payment_webhook_events
  for select to authenticated using (public.is_owner());
revoke insert, update, delete on public.payment_webhook_events from anon, authenticated;

-- rate_limits: RLS on with no policies = service role only.
revoke all on public.rate_limits from anon, authenticated;

-- Realtime ----------------------------------------------------------------------
-- The kitchen board listens to row changes (RLS applies, so only staff receive them).
alter publication supabase_realtime add table public.orders;

-- Storage -------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 5242880,
        array['image/webp', 'image/avif', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "owner uploads menu images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'menu-images' and public.is_owner());
create policy "owner updates menu images" on storage.objects
  for update to authenticated
  using (bucket_id = 'menu-images' and public.is_owner());
create policy "owner deletes menu images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'menu-images' and public.is_owner());

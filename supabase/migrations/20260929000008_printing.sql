-- Printing: customer bill + kitchen order ticket (KOT).
--   print_settings  one row: business details for the bill (Settings page) and printer options (Printers page)
--   order_prints    every ticket printed, so reprints are marked and auto-print never prints twice

create table public.print_settings (
  id smallint primary key default 1 check (id = 1),

  -- Business details printed on the bill. Edited by the owner in Settings.
  legal_name text check (length(legal_name) <= 120),
  tax_id text check (length(tax_id) <= 40),
  legal_address text check (length(legal_address) <= 200),
  vat_registered boolean not null default false,
  bill_footer jsonb not null default '{}'::jsonb check (public.is_i18n_text(bill_footer) or bill_footer = '{}'::jsonb),

  -- Printer options. Edited by the owner on the Printers page.
  paper_width_mm smallint not null default 80 check (paper_width_mm in (58, 80)),
  kot_language text not null default 'en' check (kot_language in ('en', 'ka', 'ru')),
  -- 'customer' = the language the customer used on the website.
  bill_language text not null default 'customer' check (bill_language in ('customer', 'en', 'ka', 'ru')),
  auto_print_kot boolean not null default true,
  auto_print_bill boolean not null default true,
  kot_copies smallint not null default 1 check (kot_copies between 1 and 3),
  bill_copies smallint not null default 1 check (bill_copies between 1 and 3),
  bill_show_phone boolean not null default true,
  bill_show_qr boolean not null default true,

  updated_at timestamptz not null default now()
);

insert into public.print_settings (id) values (1);

create trigger print_settings_updated_at
  before update on public.print_settings
  for each row execute function public.set_updated_at();

create table public.order_prints (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  kind text not null check (kind in ('kot', 'bill')),
  -- 1 = first print, 2+ = reprint
  copy_no smallint not null check (copy_no >= 1),
  printed_by uuid references auth.users (id) on delete set null,
  printed_at timestamptz not null default now(),
  unique (order_id, kind, copy_no)
);

create index order_prints_order_idx on public.order_prints (order_id);

alter table public.print_settings enable row level security;
alter table public.order_prints enable row level security;

create policy "staff reads print settings" on public.print_settings
  for select to authenticated using (public.is_staff());
create policy "owner updates print settings" on public.print_settings
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

create policy "staff reads prints" on public.order_prints
  for select to authenticated using (public.is_staff());
-- No insert/update/delete policies: prints are recorded only through claim_print().

/**
 * Records a print and returns its copy number (1 = first print).
 * p_first_only: used by auto-print. Returns null (and records nothing) if this ticket was
 * already printed, so two kitchen devices never both print the same order.
 */
create or replace function public.claim_print(p_order_id uuid, p_kind text, p_first_only boolean default false)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next smallint;
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
  where order_id = p_order_id and kind = p_kind;

  if p_first_only and v_next > 1 then
    return null;
  end if;

  insert into public.order_prints (order_id, kind, copy_no, printed_by)
  values (p_order_id, p_kind, v_next, auth.uid());
  return v_next;
end;
$$;

revoke all on function public.claim_print(uuid, text, boolean) from public, anon;
grant execute on function public.claim_print(uuid, text, boolean) to authenticated;

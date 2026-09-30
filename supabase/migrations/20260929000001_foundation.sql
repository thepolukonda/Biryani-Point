-- Foundation: extensions, shared types, helpers and staff roles.

create extension if not exists pgcrypto with schema extensions;

-- Translatable text is stored as {"en": "...", "ka": "...", "ru": "..."}.
-- English is required; the app falls back to it when a translation is missing.
create or replace function public.is_i18n_text(value jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(value) = 'object'
     and jsonb_typeof(value -> 'en') = 'string'
     and length(trim(value ->> 'en')) > 0
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff. Accounts are created by the owner (sign-ups are disabled);
-- a row here is what turns an auth user into staff.
-- ---------------------------------------------------------------------------
create type public.staff_role as enum ('owner', 'staff');

create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.staff_role not null default 'staff',
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  created_at timestamptz not null default now()
);

comment on table public.staff is 'Auth users allowed into /admin. owner = everything, staff = orders only.';

-- security definer so policies can call these without recursive RLS checks on public.staff.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()))
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff where user_id = (select auth.uid()) and role = 'owner'
  )
$$;

revoke execute on function public.is_staff() from public;
revoke execute on function public.is_owner() from public;
grant execute on function public.is_staff() to authenticated, anon;
grant execute on function public.is_owner() to authenticated, anon;

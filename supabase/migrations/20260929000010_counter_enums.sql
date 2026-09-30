-- New values for table (dine-in) orders and card payments at the counter.
-- In their own migration: a new enum value can only be used after it is committed.
alter type public.order_type add value if not exists 'dine_in';
alter type public.payment_method add value if not exists 'card';

create type public.order_source as enum ('website', 'counter');

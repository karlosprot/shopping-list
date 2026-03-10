-- Enable pgcrypto if not enabled yet (for gen_random_uuid etc.)
create extension if not exists pgcrypto;

-- shopping_lists: ensure created_at and last_modified_at
alter table public.shopping_lists
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists last_modified_at timestamptz;

-- shopping_items: ensure created_at
alter table public.shopping_items
  add column if not exists created_at timestamptz not null default now();

-- item_prices: ensure created_at
alter table public.item_prices
  add column if not exists created_at timestamptz not null default now();

-- Trigger to update last_modified_at on parent list when a new item is inserted
create or replace function public.set_list_last_modified()
returns trigger
language plpgsql
as $$
begin
  update public.shopping_lists
  set last_modified_at = now()
  where id = new.list_id;
  return new;
end;
$$;

drop trigger if exists trg_set_list_last_modified on public.shopping_items;

create trigger trg_set_list_last_modified
after insert on public.shopping_items
for each row
execute function public.set_list_last_modified();


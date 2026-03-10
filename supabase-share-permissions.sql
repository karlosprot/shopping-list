-- Add sharing and permission columns to shopping_lists
alter table public.shopping_lists
  add column if not exists owner_email text,
  add column if not exists share_token text unique,
  add column if not exists permission_level text not null default 'read-only';

alter table public.shopping_lists
  add constraint shopping_lists_permission_level_check
  check (permission_level in ('read-only', 'edit'));


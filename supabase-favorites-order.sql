-- Favorites support for shopping_items

alter table public.shopping_items
  add column if not exists is_favorite boolean not null default false;


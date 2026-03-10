-- Oblíbené seznamy

alter table public.shopping_lists
  add column if not exists is_favorite boolean not null default false;

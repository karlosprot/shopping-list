-- Ordering support for shopping_items

alter table public.shopping_items
  add column if not exists position integer;

-- Optional: initialise position for existing rows per list & checked state
-- (you can run this once to seed positions based on created_at)
update public.shopping_items i
set position = sub.rn
from (
  select id,
         row_number() over (partition by list_id, checked order by created_at) as rn
  from public.shopping_items
) as sub
where i.id = sub.id
  and i.position is null;


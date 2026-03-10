-- Price entries per shopping item (store + price in CZK)
CREATE TABLE item_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES shopping_items(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_item_prices_item_id ON item_prices(item_id);

-- RLS
ALTER TABLE item_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on item_prices" ON item_prices FOR ALL USING (true) WITH CHECK (true);

-- Realtime: v Supabase Dashboard > Database > Replication přidej tabulku item_prices

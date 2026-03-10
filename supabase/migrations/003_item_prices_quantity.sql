-- Přidání množství a ceny za jednotku
ALTER TABLE item_prices ADD COLUMN quantity NUMERIC(10, 2) NOT NULL DEFAULT 1;
ALTER TABLE item_prices ADD COLUMN unit_price NUMERIC(10, 1) NOT NULL DEFAULT 0;

-- Pro existující záznamy doplň unit_price (quantity už je 1 z DEFAULT)
UPDATE item_prices SET unit_price = ROUND(price / quantity, 1);

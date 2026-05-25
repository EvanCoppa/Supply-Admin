-- Change purchase_line_items quantity column to integer
ALTER TABLE purchase_line_items
ALTER COLUMN quantity SET DATA TYPE integer USING ROUND(quantity)::integer;

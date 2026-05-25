-- Add tax columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_state VARCHAR(2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_zip VARCHAR(10);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,4);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_before_tax DECIMAL(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_calculated_at TIMESTAMP;

-- Create indexes for fast lookups and reporting
CREATE INDEX IF NOT EXISTS idx_orders_shipping_state ON orders(shipping_state);
CREATE INDEX IF NOT EXISTS idx_orders_tax_calculated ON orders(tax_calculated_at);

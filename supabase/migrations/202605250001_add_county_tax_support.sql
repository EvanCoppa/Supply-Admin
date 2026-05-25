-- Add sample county-level tax rates for major counties
-- These will override state rates when applicable
INSERT INTO tax_rates (state_code, county_code, tax_rate, effective_from) VALUES
-- California counties (example: LA County adds local tax)
('CA', '06037', 0.0950, NOW()), -- Los Angeles County
('CA', '06075', 0.0850, NOW()), -- San Francisco County
('CA', '06085', 0.0925, NOW()), -- Santa Clara County
-- New York counties
('NY', '36061', 0.0875, NOW()), -- New York County (Manhattan)
('NY', '36081', 0.0875, NOW()), -- Queens County
('NY', '36005', 0.0875, NOW()), -- Bronx County
-- Texas counties
('TX', '48201', 0.0825, NOW()), -- Harris County (Houston)
('TX', '48439', 0.0825, NOW()), -- Travis County (Austin)
('TX', '48121', 0.0825, NOW())  -- Dallas County
ON CONFLICT DO NOTHING;

-- Create index for county lookups
CREATE INDEX IF NOT EXISTS idx_tax_rates_county_lookup
  ON tax_rates(state_code, county_code, effective_from DESC)
  WHERE county_code IS NOT NULL;

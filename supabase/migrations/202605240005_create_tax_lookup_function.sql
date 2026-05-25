-- Create function to get current tax rate for a state
CREATE OR REPLACE FUNCTION get_tax_rate_for_state(
  p_state_code VARCHAR,
  p_lookup_date TIMESTAMP DEFAULT NOW()
)
RETURNS DECIMAL AS $$
  SELECT tax_rate
  FROM tax_rates
  WHERE state_code = UPPER(p_state_code)
    AND county_code IS NULL
    AND effective_from <= p_lookup_date
    AND (effective_to IS NULL OR effective_to > p_lookup_date)
  ORDER BY effective_from DESC
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

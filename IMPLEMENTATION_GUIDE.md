# Tax Prefilling Implementation Guide

## Overview

This system automatically calculates and prefills sales tax based on the shipping address (state) for orders. Tax is calculated at the order level, after discounts are applied.

## Database Setup

### 1. Apply Migrations

Run these migrations in order in the Supabase dashboard or via CLI:

```bash
supabase migration up
```

Migrations created:

- `202605240003_create_tax_rates_table.sql` - Creates `tax_rates` table with all US state rates
- `202605240004_add_tax_columns_to_orders.sql` - Adds tax tracking columns to orders
- `202605240005_create_tax_lookup_function.sql` - Creates lookup function

### 2. Verify Setup

Check Supabase to ensure:

- `tax_rates` table exists with 50 state rates populated
- `orders` table has new columns: `shipping_state`, `tax_rate`, `tax_amount`, `subtotal_before_tax`, `tax_calculated_at`
- `get_tax_rate_for_state()` function is available

## Backend Setup

### Edge Function

The Edge Function `/functions/v1/calculate-order-tax` handles tax calculation requests.

**File:** `supabase/functions/calculate-order-tax/index.ts`

**Deploy it:**

```bash
supabase functions deploy calculate-order-tax
```

**Request:**

```json
{
  "state": "CA",
  "subtotal": 100.0
}
```

**Response:**

```json
{
  "tax_rate": 0.0725,
  "tax_amount": 7.25,
  "total": 107.25
}
```

## Frontend Integration

### 1. Utility Functions

**File:** `src/lib/tax-utils.ts`

Exports:

- `calculateTaxForOrder(state, subtotal)` - Calls the Edge Function
- `extractStateFromAddress(address)` - Extracts state from address object
- `formatCurrency(amount)` - Formats numbers as USD

### 2. Custom Hook

**File:** `src/hooks/useTaxCalculation.ts`

Usage:

```typescript
const { taxCalculation, loading, error, calculateTax } = useTaxCalculation();

// When user selects an address:
await calculateTax('CA', 100.0);

// Access results:
console.log(taxCalculation.tax_amount); // 7.25
```

### 3. Example Component

**File:** `src/components/OrderTaxCalculation.example.tsx`

This shows how to integrate tax calculation into your order form.

## Integration in Order Form

Here's how to add tax prefilling to your existing order form:

```typescript
import { useTaxCalculation } from "@/hooks/useTaxCalculation";
import { extractStateFromAddress } from "@/lib/tax-utils";

function OrderForm() {
  const [orderForm, setOrderForm] = useState({
    shipping_address: null,
    items: [],
    discount: 0,
    tax_rate: 0,
    tax_amount: 0,
    total: 0,
  });

  const { taxCalculation, calculateTax } = useTaxCalculation();

  const handleAddressSelected = async (address) => {
    setOrderForm(prev => ({
      ...prev,
      shipping_address: address
    }));

    // Extract state and calculate tax
    const state = extractStateFromAddress(address);
    if (state) {
      const subtotalAfterDiscount = calculateSubtotal();
      await calculateTax(state, subtotalAfterDiscount);
    }
  };

  useEffect(() => {
    if (taxCalculation) {
      setOrderForm(prev => ({
        ...prev,
        tax_rate: taxCalculation.tax_rate,
        tax_amount: taxCalculation.tax_amount,
        total: taxCalculation.total
      }));
    }
  }, [taxCalculation]);

  return (
    <form>
      {/* Your AddressAutocomplete component */}
      <AddressAutocomplete onSelect={handleAddressSelected} />

      {/* Display tax summary */}
      <OrderTaxCalculation
        address={orderForm.shipping_address}
        subtotalAfterDiscount={calculateSubtotal()}
        onTaxCalculated={(tax) =>
          setOrderForm(prev => ({
            ...prev,
            tax_rate: tax.rate,
            tax_amount: tax.amount,
            total: tax.total
          }))
        }
      />

      {/* Tax fields in form */}
      <div className="tax-section">
        <p>Tax Rate: {(orderForm.tax_rate * 100).toFixed(2)}%</p>
        <p>Tax Amount: ${orderForm.tax_amount.toFixed(2)}</p>
        <p>Total: ${orderForm.total.toFixed(2)}</p>
      </div>
    </form>
  );
}
```

## When Tax is Recalculated

Tax automatically recalculates when:

- ✅ Shipping address changes
- ✅ Discount is applied/removed
- ✅ Order items are added/removed (changes subtotal)

Tax is NOT recalculated on every keystroke - calculation is debounced.

## Updating Tax Rates

Tax rates are stored in the `tax_rates` table with `effective_from` and `effective_to` dates.

To update rates:

```sql
-- Mark old rate as ending
UPDATE tax_rates
SET effective_to = NOW()
WHERE state_code = 'CA' AND effective_to IS NULL;

-- Add new rate
INSERT INTO tax_rates (state_code, tax_rate, effective_from)
VALUES ('CA', 0.0800, NOW());
```

Or create a background job that syncs rates from TaxJar/Avalara APIs.

## Testing

### Manual Testing

1. Go to order creation form
2. Select an address with a valid US state
3. Verify tax calculation displays correctly
4. Verify tax updates when discount changes
5. Submit and verify tax is saved to database

### Edge Cases to Test

- No state in address → should show "Select an address to calculate tax"
- Unknown state → should return zero tax with error
- Zero subtotal → should return zero tax
- Tax change between form load and submission → handle in form validation

## Future Enhancements

1. **County/Local Taxes** - Add support for county and city tax rates
2. **Tax-Exempt Items** - Add per-product tax categories (taxable/exempt)
3. **Real-time Sync** - Sync rates from TaxJar or Avalara automatically
4. **Tax Reporting** - Generate tax reports by state and date range
5. **Shipping Address Validation** - Validate address before calculating tax

## Troubleshooting

**Tax calculation returns 0%:**

- Check that state code is correctly extracted from address
- Verify state code exists in `tax_rates` table (should be 2 uppercase letters)

**Edge Function returns error:**

- Check Supabase logs: `supabase functions logs calculate-order-tax`
- Ensure CORS is configured correctly

**Tax doesn't update:**

- Check browser console for errors
- Verify Edge Function is deployed
- Check network tab to see Edge Function response

# AddressInput Component Usage Guide

## Overview

The `AddressInput` component is a reusable address form field that includes OpenStreetMap autocomplete functionality. It wraps the `AddressAutocomplete` component with form fields for manual input.

## Basic Usage

```svelte
<script>
  import AddressInput from '$lib/components/AddressInput.svelte';
</script>

<form method="POST">
  <AddressInput namePrefix="" />
  <button type="submit">Save</button>
</form>
```

## Props

| Prop                | Type    | Default     | Description                       |
| ------------------- | ------- | ----------- | --------------------------------- |
| `label`             | string  | `'Address'` | Section heading label             |
| `namePrefix`        | string  | `'address'` | Prefix for form field names       |
| `initialLabel`      | string  | `''`        | Initial label value (for editing) |
| `initialLine1`      | string  | `''`        | Initial street address            |
| `initialLine2`      | string  | `''`        | Initial apartment/suite           |
| `initialCity`       | string  | `''`        | Initial city                      |
| `initialRegion`     | string  | `''`        | Initial state/province            |
| `initialPostalCode` | string  | `''`        | Initial postal code               |
| `initialCountry`    | string  | `''`        | Initial country (2-letter ISO)    |
| `required`          | boolean | `true`      | Make core fields required         |
| `hideLabel`         | boolean | `false`     | Hide the section heading          |

## Form Field Names

The component outputs form fields with the following names:

**With `namePrefix=""` (default for simple forms):**

- `label`
- `line1`
- `line2`
- `city`
- `region`
- `postal_code`
- `country`

**With `namePrefix="shipping"` (for multiple addresses):**

- `shipping_label`
- `shipping_line1`
- `shipping_line2`
- `shipping_city`
- `shipping_region`
- `shipping_postal_code`
- `shipping_country`

## Examples

### Example 1: Customer Address Form (Existing)

```svelte
<form method="POST" action="?/create">
  <AddressInput namePrefix="" hideLabel={true} />
  <input type="checkbox" name="is_default_shipping" />
  <button type="submit">Add address</button>
</form>
```

### Example 2: Order Shipping Address

```svelte
<script>
  import AddressInput from '$lib/components/AddressInput.svelte';
</script>

<form method="POST">
  <AddressInput
    label="Shipping Address"
    namePrefix="shipping"
    initialLine1={order.shipping_address?.line1 || ''}
    initialCity={order.shipping_address?.city || ''}
    initialRegion={order.shipping_address?.region || ''}
    initialPostalCode={order.shipping_address?.postal_code || ''}
    initialCountry={order.shipping_address?.country || ''}
  />
  <button type="submit">Update Order</button>
</form>
```

### Example 3: Optional Address Field

```svelte
<AddressInput label="Billing Address" namePrefix="billing" required={false} />
```

### Example 4: Programmatic Access

```svelte
<script>
  import AddressInput from '$lib/components/AddressInput.svelte';

  let addressRef;

  function handleSubmit() {
    const address = addressRef.getAddress();
    console.log(address);
    // { label: '...', line1: '...', city: '...', ... }
  }
</script>

<AddressInput bind:this={addressRef} />
<button onclick={handleSubmit}>Get Address Data</button>
```

## Component Methods

### `getAddress()`

Returns the current address data as an object:

```typescript
{
  label: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
}
```

### `reset()`

Resets the form to its initial values (from props).

## Features

✅ OpenStreetMap autocomplete with no API key needed  
✅ 300ms debouncing to respect rate limits  
✅ Auto-fills all fields when address is selected  
✅ All fields remain manually editable  
✅ Support for prefixed field names (for multiple addresses on one form)  
✅ Initial value support (for editing existing addresses)  
✅ Optional/required field control

## Auto-Fill Flow

1. User types in "Search address" field (min 3 characters)
2. Suggestions appear from OpenStreetMap
3. User clicks a suggestion
4. All address fields auto-populate with structured data
5. User can edit any field before submitting
6. Form submits with field names based on `namePrefix`

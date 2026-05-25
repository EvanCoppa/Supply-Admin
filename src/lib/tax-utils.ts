import { supabase } from "./supabase";

export interface TaxCalculation {
  tax_rate: number;
  tax_amount: number;
  total: number;
}

export async function calculateTaxForOrder(
  state: string,
  subtotalAfterDiscount: number
): Promise<TaxCalculation> {
  try {
    const response = await fetch(
      `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/calculate-order-tax`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          state,
          subtotal: subtotalAfterDiscount,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Tax calculation failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error calculating tax:", error);
    // Fallback: return zero tax on error
    return {
      tax_rate: 0,
      tax_amount: 0,
      total: subtotalAfterDiscount,
    };
  }
}

export function extractStateFromAddress(address: {
  state?: string;
  state_province?: string;
  province?: string;
  administrative_area_level_1?: string;
}): string | null {
  return (
    address.state ||
    address.state_province ||
    address.province ||
    address.administrative_area_level_1 ||
    null
  );
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

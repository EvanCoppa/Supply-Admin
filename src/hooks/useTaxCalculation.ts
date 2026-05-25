import { useState, useCallback } from "react";
import { calculateTaxForOrder, TaxCalculation } from "@/lib/tax-utils";

interface UseTaxCalculationResult {
  taxCalculation: TaxCalculation | null;
  loading: boolean;
  error: string | null;
  calculateTax: (state: string, subtotal: number) => Promise<void>;
}

export function useTaxCalculation(): UseTaxCalculationResult {
  const [taxCalculation, setTaxCalculation] = useState<TaxCalculation | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateTax = useCallback(
    async (state: string, subtotal: number) => {
      if (!state) {
        setTaxCalculation(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await calculateTaxForOrder(state, subtotal);
        setTaxCalculation(result);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to calculate tax"
        );
        setTaxCalculation(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { taxCalculation, loading, error, calculateTax };
}

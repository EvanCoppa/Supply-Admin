import { useMemo, useEffect } from "react";
import { useTaxCalculation } from "@/hooks/useTaxCalculation";
import { extractStateFromAddress, formatCurrency } from "@/lib/tax-utils";

interface OrderAddress {
  state?: string;
  state_province?: string;
  province?: string;
  administrative_area_level_1?: string;
}

interface OrderTaxCalculationProps {
  address: OrderAddress | null;
  subtotalAfterDiscount: number;
  onTaxCalculated?: (tax: {
    rate: number;
    amount: number;
    total: number;
  }) => void;
}

/**
 * Example component showing how to integrate tax prefilling
 * Usage in your order form:
 *
 * <OrderTaxCalculation
 *   address={formData.shipping_address}
 *   subtotalAfterDiscount={calculateSubtotal()}
 *   onTaxCalculated={(tax) => setOrderForm(prev => ({
 *     ...prev,
 *     tax_rate: tax.rate,
 *     tax_amount: tax.amount,
 *     total: tax.total
 *   }))}
 * />
 */
export function OrderTaxCalculation({
  address,
  subtotalAfterDiscount,
  onTaxCalculated,
}: OrderTaxCalculationProps) {
  const { taxCalculation, loading, error, calculateTax } =
    useTaxCalculation();

  const state = useMemo(() => {
    if (!address) return null;
    return extractStateFromAddress(address);
  }, [address]);

  // Recalculate tax whenever state or subtotal changes
  useEffect(() => {
    if (state && subtotalAfterDiscount > 0) {
      calculateTax(state, subtotalAfterDiscount);
    }
  }, [state, subtotalAfterDiscount, calculateTax]);

  // Notify parent component when tax calculation completes
  useEffect(() => {
    if (taxCalculation && onTaxCalculated) {
      onTaxCalculated({
        rate: taxCalculation.tax_rate,
        amount: taxCalculation.tax_amount,
        total: taxCalculation.total,
      });
    }
  }, [taxCalculation, onTaxCalculated]);

  if (!state) {
    return (
      <div className="p-4 bg-gray-50 rounded">
        <p className="text-sm text-gray-500">Select an address to calculate tax</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-blue-50 rounded border border-blue-200">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal (after discount):</span>
          <span className="font-medium">{formatCurrency(subtotalAfterDiscount)}</span>
        </div>

        {loading && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Tax ({state}):</span>
            <span className="text-gray-400">Calculating...</span>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600">
            Tax calculation error: {error}
          </div>
        )}

        {taxCalculation && !loading && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                Tax ({state}):
                <span className="text-xs text-gray-500 ml-1">
                  ({(taxCalculation.tax_rate * 100).toFixed(2)}%)
                </span>
              </span>
              <span className="font-medium">
                {formatCurrency(taxCalculation.tax_amount)}
              </span>
            </div>

            <div className="border-t border-blue-200 pt-2 flex justify-between">
              <span className="font-semibold">Total:</span>
              <span className="font-semibold text-lg">
                {formatCurrency(taxCalculation.total)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

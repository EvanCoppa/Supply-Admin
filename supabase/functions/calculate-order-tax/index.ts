import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!
);

interface TaxCalculationRequest {
  state: string;
  subtotal: number; // Amount after discounts
}

interface TaxCalculationResponse {
  tax_rate: number;
  tax_amount: number;
  total: number;
}

Deno.serve(async (req) => {
  // CORS headers
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const { state, subtotal }: TaxCalculationRequest = await req.json();

    if (!state || typeof subtotal !== "number") {
      return new Response(
        JSON.stringify({ error: "Missing state or subtotal" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get tax rate for state
    const { data: taxData, error: taxError } = await supabase
      .from("tax_rates")
      .select("tax_rate")
      .eq("state_code", state.toUpperCase())
      .is("county_code", null)
      .lte("effective_from", new Date().toISOString())
      .or(
        `effective_to.is.null,effective_to.gt.${new Date().toISOString()}`
      )
      .order("effective_from", { ascending: false })
      .limit(1)
      .single();

    if (taxError || !taxData) {
      return new Response(
        JSON.stringify({
          error: `No tax rate found for state: ${state}`,
          tax_rate: 0,
          tax_amount: 0,
          total: subtotal,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const taxRate = parseFloat(taxData.tax_rate as unknown as string);
    const taxAmount = parseFloat((subtotal * taxRate).toFixed(2));
    const total = parseFloat((subtotal + taxAmount).toFixed(2));

    const response: TaxCalculationResponse = {
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total: total,
    };

    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error calculating tax:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

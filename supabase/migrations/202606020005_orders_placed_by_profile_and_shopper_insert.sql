-- Record which shopper placed each order, and allow storefront shoppers to INSERT orders
-- (read policies already work via the repointed current_customer_id()).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS placed_by_profile_id uuid REFERENCES public.customer_profiles(id);

CREATE INDEX IF NOT EXISTS orders_placed_by_profile_idx
  ON public.orders (placed_by_profile_id);

-- Shopper insert: must be for their own business account.
DROP POLICY IF EXISTS orders_shopper_insert ON public.orders;
CREATE POLICY orders_shopper_insert
  ON public.orders FOR INSERT
  WITH CHECK (customer_id = public.current_customer_id());

-- Shopper insert of line items: order must belong to their business account.
DROP POLICY IF EXISTS order_line_items_shopper_insert ON public.order_line_items;
CREATE POLICY order_line_items_shopper_insert
  ON public.order_line_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
      AND o.customer_id = public.current_customer_id()
  ));

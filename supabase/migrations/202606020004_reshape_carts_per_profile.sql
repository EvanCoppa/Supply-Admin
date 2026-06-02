-- Carts and cart_items are reshaped to be per-shopper (customer_profiles.id) rather than
-- per-business-account. Two buyers from the same business should have separate carts.
-- Both tables are empty today (verified pre-migration) so this is a safe replace.

DROP TABLE IF EXISTS public.cart_items;
DROP TABLE IF EXISTS public.carts;

CREATE TABLE public.carts (
  profile_id uuid PRIMARY KEY REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, product_id)
);

CREATE INDEX cart_items_profile_idx ON public.cart_items (profile_id);

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY carts_owner_or_admin
  ON public.carts FOR ALL
  USING (profile_id = auth.uid() OR public.is_admin())
  WITH CHECK (profile_id = auth.uid() OR public.is_admin());

CREATE POLICY cart_items_owner_or_admin
  ON public.cart_items FOR ALL
  USING (profile_id = auth.uid() OR public.is_admin())
  WITH CHECK (profile_id = auth.uid() OR public.is_admin());

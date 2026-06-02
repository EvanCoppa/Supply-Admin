-- Move the legacy role='customer' user_profiles rows into customer_profiles, rewrite the
-- three RLS policies that inline user_profiles.customer_id to use the (repointed)
-- current_customer_id() helper, then purge the 'customer' role from user_profiles entirely.

-- 1. Move shopper rows into customer_profiles. Email comes from auth.users.
INSERT INTO public.customer_profiles (id, customer_id, email, role, is_primary)
SELECT up.id, up.customer_id, au.email, 'owner'::public.customer_profile_role, true
FROM public.user_profiles up
JOIN auth.users au ON au.id = up.id
WHERE up.role = 'customer' AND up.customer_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- 2. Repoint current_customer_id() to read from customer_profiles. After this, every
--    customer-scoped RLS policy that goes through this helper keeps working unchanged.
CREATE OR REPLACE FUNCTION public.current_customer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT customer_id
  FROM public.customer_profiles
  WHERE id = auth.uid() AND deactivated_at IS NULL;
$$;

-- 3. Rewrite the three RLS policies that inline user_profiles.customer_id lookups so they
--    use current_customer_id() instead. (PG can't ALTER a policy predicate; drop + recreate.)
DROP POLICY IF EXISTS invoices_customer_select ON public.invoices;
CREATE POLICY invoices_customer_select
  ON public.invoices FOR SELECT
  USING (status <> 'draft' AND customer_id = public.current_customer_id());

DROP POLICY IF EXISTS invoice_line_items_customer_select ON public.invoice_line_items;
CREATE POLICY invoice_line_items_customer_select
  ON public.invoice_line_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.invoices inv
    WHERE inv.id = invoice_line_items.invoice_id
      AND inv.status <> 'draft'
      AND inv.customer_id = public.current_customer_id()
  ));

DROP POLICY IF EXISTS invoice_payment_intents_customer_select ON public.invoice_payment_intents;
CREATE POLICY invoice_payment_intents_customer_select
  ON public.invoice_payment_intents FOR SELECT
  USING (customer_id = public.current_customer_id());

-- 4. Drop the CHECK constraint that tied role='customer' to a non-null customer_id.
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_customer_link_valid;

-- 5. Delete migrated customer-role rows from user_profiles.
DELETE FROM public.user_profiles WHERE role = 'customer';

-- 6. Drop the now-dead customer_id column from user_profiles.
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS customer_id;

-- 7. Remove the 'customer' role from the lookup table (staff-only now).
DELETE FROM public.roles WHERE id = 'customer';

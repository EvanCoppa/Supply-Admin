-- Create customer_profiles: individual shopper-people with logins, linked to a customers
-- business account (the "client" in admin UI). Parallel to user_profiles (staff/admins).

CREATE TYPE public.customer_profile_role AS ENUM ('owner', 'buyer', 'viewer');

CREATE TABLE public.customer_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  email text NOT NULL,
  first_name text,
  last_name text,
  phone text,
  role public.customer_profile_role NOT NULL DEFAULT 'buyer',
  is_primary boolean NOT NULL DEFAULT false,
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX customer_profiles_email_unique
  ON public.customer_profiles (lower(email));
CREATE UNIQUE INDEX customer_profiles_one_primary_per_customer
  ON public.customer_profiles (customer_id) WHERE is_primary;
CREATE INDEX customer_profiles_customer_idx
  ON public.customer_profiles (customer_id);

CREATE TRIGGER customer_profiles_set_updated_at
  BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_profiles_admin_all
  ON public.customer_profiles FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY customer_profiles_self_read
  ON public.customer_profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY customer_profiles_peer_read
  ON public.customer_profiles FOR SELECT
  USING (customer_id = public.current_customer_id());

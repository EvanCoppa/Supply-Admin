-- Create roles lookup table and populate with available roles

create table if not exists public.roles (
  id text primary key,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

-- Insert role definitions
insert into public.roles (id, name, description)
values
  ('admin', 'Admin', 'Full system access. Can manage users, catalog, customers, orders, invoices, territories, tasks, and analytics.'),
  ('sales_rep', 'Sales Rep', 'Customer and order management. Can view customers, manage orders, track tasks, and view analytics.'),
  ('accounting', 'Accounting', 'Financial management. Can manage invoices, orders, and view analytics.'),
  ('warehouse_staff', 'Warehouse Staff', 'Order fulfillment. Can manage orders only.'),
  ('new_hire', 'New Hire', 'Onboarding access. Limited to dashboard only to avoid overwhelming new team members.'),
  ('customer', 'Customer', 'External customer access. Limited to portal features only.')
on conflict (id) do nothing;

-- Add role_id foreign key to user_profiles if it doesn't exist
alter table public.user_profiles
  add constraint user_profiles_role_fk
    foreign key (role) references public.roles(id) on delete restrict
    not valid;

-- Validate the constraint (this will check existing data)
alter table public.user_profiles validate constraint user_profiles_role_fk;

comment on table public.roles is 'Available user roles with descriptions and permissions';
comment on column public.roles.id is 'Unique role identifier (e.g., admin, sales_rep)';
comment on column public.roles.name is 'Human-readable role name';
comment on column public.roles.description is 'Description of role responsibilities and access level';

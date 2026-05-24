alter table public.user_profiles
add column deactivated_at timestamptz;

comment on column public.user_profiles.deactivated_at is 'Timestamp when the admin user was deactivated. NULL means active.';

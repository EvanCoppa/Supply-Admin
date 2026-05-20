-- Deep invoicing support: editable invoice line items, email history, and payment intents.

alter table public.invoices
  add column if not exists billing_email text,
  add column if not exists customer_memo text,
  add column if not exists internal_notes text,
  add column if not exists discount numeric(12, 2) not null default 0,
  add column if not exists sent_at timestamptz,
  add column if not exists last_reminded_at timestamptz,
  add column if not exists payment_url text,
  add column if not exists payment_status text not null default 'not_started';

do $$
begin
  alter table public.invoices
    add constraint invoices_payment_status_check
    check (payment_status in ('not_started', 'intent_created', 'processing', 'paid', 'failed', 'cancelled'));
exception
  when duplicate_object then null;
end $$;

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  order_line_item_id uuid references public.order_line_items(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  product_sku_snapshot text,
  product_name_snapshot text,
  description text not null,
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  line_total numeric(12, 2) not null default 0,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_line_items_quantity_check check (quantity > 0),
  constraint invoice_line_items_money_check check (
    unit_price >= 0 and discount >= 0 and tax >= 0 and line_total >= 0
  )
);

create index if not exists invoice_line_items_invoice_id_idx
  on public.invoice_line_items(invoice_id, display_order);

create table if not exists public.invoice_email_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  type text not null,
  recipient text not null,
  subject text not null,
  status text not null,
  provider text,
  provider_message_id text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint invoice_email_events_type_check check (type in ('send', 'reminder', 'receipt')),
  constraint invoice_email_events_status_check check (status in ('sent', 'failed', 'skipped'))
);

create index if not exists invoice_email_events_invoice_id_idx
  on public.invoice_email_events(invoice_id, created_at desc);

create table if not exists public.invoice_payment_intents (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount numeric(12, 2) not null,
  currency text not null default 'usd',
  status text not null default 'created',
  provider text not null default 'manual_api',
  provider_reference text,
  payment_url text,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_payment_intents_amount_check check (amount > 0),
  constraint invoice_payment_intents_status_check check (
    status in ('created', 'processing', 'succeeded', 'failed', 'cancelled', 'expired')
  )
);

create index if not exists invoice_payment_intents_invoice_id_idx
  on public.invoice_payment_intents(invoice_id, created_at desc);

alter table public.invoice_line_items enable row level security;
alter table public.invoice_email_events enable row level security;
alter table public.invoice_payment_intents enable row level security;

do $$
begin
  create policy invoices_customer_select
    on public.invoices
    for select
    to authenticated
    using (
      status <> 'draft'
      and exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and up.role = 'customer'
          and up.customer_id = invoices.customer_id
      )
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy invoice_line_items_admin_all
    on public.invoice_line_items
    for all
    to authenticated
    using (
      exists (
        select 1 from public.user_profiles up
        where up.id = auth.uid() and up.role = 'admin'
      )
    )
    with check (
      exists (
        select 1 from public.user_profiles up
        where up.id = auth.uid() and up.role = 'admin'
      )
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy invoice_line_items_customer_select
    on public.invoice_line_items
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.invoices inv
        join public.user_profiles up on up.customer_id = inv.customer_id
        where inv.id = invoice_line_items.invoice_id
          and inv.status <> 'draft'
          and up.id = auth.uid()
          and up.role = 'customer'
      )
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy invoice_email_events_admin_all
    on public.invoice_email_events
    for all
    to authenticated
    using (
      exists (
        select 1 from public.user_profiles up
        where up.id = auth.uid() and up.role = 'admin'
      )
    )
    with check (
      exists (
        select 1 from public.user_profiles up
        where up.id = auth.uid() and up.role = 'admin'
      )
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy invoice_payment_intents_admin_all
    on public.invoice_payment_intents
    for all
    to authenticated
    using (
      exists (
        select 1 from public.user_profiles up
        where up.id = auth.uid() and up.role = 'admin'
      )
    )
    with check (
      exists (
        select 1 from public.user_profiles up
        where up.id = auth.uid() and up.role = 'admin'
      )
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy invoice_payment_intents_customer_select
    on public.invoice_payment_intents
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and up.role = 'customer'
          and up.customer_id = invoice_payment_intents.customer_id
      )
    );
exception
  when duplicate_object then null;
end $$;

comment on table public.invoice_line_items is
  'Snapshotted invoice rows for order-backed and standalone invoices.';

comment on table public.invoice_email_events is
  'History of invoice emails and reminders sent through the app.';

comment on table public.invoice_payment_intents is
  'Internal payment-intent boundary for invoice payment providers.';

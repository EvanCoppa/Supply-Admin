-- Shipping label integration (EasyPost): persist purchased-label details on orders.
alter table public.orders
  add column if not exists carrier text,
  add column if not exists carrier_service text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists label_url text,
  add column if not exists shipment_id text,
  add column if not exists label_purchased_at timestamptz;

comment on column public.orders.carrier is
  'Carrier of the purchased shipping label (e.g. USPS, UPS).';
comment on column public.orders.carrier_service is
  'Carrier service level of the purchased label (e.g. Priority, Ground).';
comment on column public.orders.tracking_number is
  'Tracking number — from a purchased label or entered manually at ship time.';
comment on column public.orders.tracking_url is
  'Public tracking URL for the shipment, when available.';
comment on column public.orders.label_url is
  'URL of the purchased label document (PDF/PNG) for printing.';
comment on column public.orders.shipment_id is
  'EasyPost shipment id the label was purchased against.';
comment on column public.orders.label_purchased_at is
  'When the shipping label was purchased.';

create index if not exists idx_orders_tracking_number on public.orders(tracking_number);

// Hand-written Supabase row types — mirrors supabase/migrations/0001_init_schema.sql
// and 0003_crm_tables.sql.
// Replace with `supabase gen types` output from packages/shared once that exists.

export type UserRole = 'customer' | 'admin';
export type CustomerStatus = 'active' | 'suspended' | 'archived';
export type CustomerLifecycleStage = 'lead' | 'prospect' | 'active' | 'at_risk' | 'churned';
export type ContactRole = 'primary' | 'billing' | 'shipping' | 'clinical' | 'other';
export type ActivityType = 'call' | 'email' | 'meeting' | 'visit' | 'sms' | 'other';
export type ActivityDirection = 'inbound' | 'outbound';
export type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'paid'
  | 'partially_paid'
  | 'overdue'
  | 'void'
  | 'refunded';
export type InvoiceTerms = 'due_on_receipt' | 'net_15' | 'net_30' | 'net_60' | 'prepaid';
export type RmaStatus = 'requested' | 'approved' | 'received' | 'refunded' | 'rejected' | 'cancelled';
export type ProductStatus = 'active' | 'archived';
export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'fulfilled'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';
export type OrderSource = 'storefront' | 'api';
export type InventoryReason =
  | 'order'
  | 'cancellation'
  | 'refund'
  | 'manual_adjustment'
  | 'receipt';
export type PricingScope = 'product' | 'category';
export type PricingOverrideType = 'absolute_price' | 'percent_discount';
export type PaymentStatus = 'succeeded' | 'failed' | 'refunded';

export interface UserProfile {
  id: string;
  role: UserRole;
  customer_id: string | null;
  display_name: string | null;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  business_name: string;
  primary_contact_name: string | null;
  email: string | null;
  phone: string | null;
  assigned_sales_rep_id: string | null;
  status: CustomerStatus;
  lifecycle_stage: CustomerLifecycleStage;
  territory_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  is_default_shipping: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  display_order: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category_id: string | null;
  manufacturer: string | null;
  unit_of_measure: string | null;
  pack_size: number | null;
  base_price: number;
  tax_class: string | null;
  weight_grams: number | null;
  image_paths: string[];
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  product_id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  low_stock_threshold: number;
  updated_at: string;
}

export interface InventoryLedgerEntry {
  id: string;
  product_id: string;
  delta: number;
  reason: InventoryReason;
  order_id: string | null;
  actor_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface CustomerPricingRule {
  id: string;
  customer_id: string;
  scope: PricingScope;
  product_id: string | null;
  category_id: string | null;
  override_type: PricingOverrideType;
  absolute_price: number | null;
  percent_discount: number | null;
  effective_start: string | null;
  effective_end: string | null;
  created_at: string;
}

export interface FeaturedGroup {
  id: string;
  name: string;
  description: string | null;
  product_ids: string[];
  created_at: string;
}

export interface CustomerFeaturedItem {
  id: string;
  customer_id: string;
  product_id: string | null;
  group_id: string | null;
  display_order: number;
  created_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  shipping_address_snapshot: Record<string, unknown> | null;
  payment_reference: string | null;
  source: OrderSource;
  idempotency_key: string | null;
  placed_at: string;
  updated_at: string;
}

export interface OrderLineItem {
  id: string;
  order_id: string;
  product_id: string;
  product_sku_snapshot: string;
  product_name_snapshot: string;
  quantity: number;
  unit_price_snapshot: number;
  line_total: number;
}

export interface PaymentAttempt {
  id: string;
  order_id: string | null;
  customer_id: string;
  amount: number;
  status: PaymentStatus;
  gateway_reference: string | null;
  gateway_response: Record<string, unknown> | null;
  created_at: string;
}

export interface ApiToken {
  id: string;
  customer_id: string;
  token_hash: string;
  label: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface Territory {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface CustomerTag {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface CustomerTagAssignment {
  customer_id: string;
  tag_id: string;
  created_at: string;
}

export interface CustomerContact {
  id: string;
  customer_id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  role: ContactRole | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerNote {
  id: string;
  customer_id: string;
  author_id: string | null;
  body: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerActivity {
  id: string;
  customer_id: string;
  contact_id: string | null;
  actor_id: string | null;
  type: ActivityType;
  direction: ActivityDirection | null;
  subject: string | null;
  body: string | null;
  occurred_at: string;
  created_at: string;
}

export interface CustomerTask {
  id: string;
  customer_id: string;
  assigned_to: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  related_activity_id: string | null;
  related_order_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerCredit {
  customer_id: string;
  credit_limit: number;
  net_terms_days: number | null;
  on_hold: boolean;
  hold_reason: string | null;
  updated_at: string;
}

export interface Invoice {
  id: string;
  customer_id: string;
  order_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  amount_paid: number;
  terms: InvoiceTerms | null;
  issued_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  billing_address_snapshot: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Rma {
  id: string;
  customer_id: string;
  order_id: string;
  rma_number: string;
  status: RmaStatus;
  reason: string | null;
  refund_amount: number;
  restocking_fee: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RmaItem {
  id: string;
  rma_id: string;
  order_line_item_id: string | null;
  product_id: string;
  quantity: number;
  unit_refund: number;
  reason: string | null;
  restock: boolean;
}

export interface CustomerHealth {
  customer_id: string;
  business_name: string;
  lifecycle_stage: CustomerLifecycleStage;
  status: CustomerStatus;
  assigned_sales_rep_id: string | null;
  territory_id: string | null;
  last_order_at: string | null;
  lifetime_orders: number;
  lifetime_revenue: number;
  open_tasks: number;
  overdue_tasks: number;
  overdue_invoices: number;
  outstanding_balance: number;
}

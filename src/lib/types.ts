export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category_id: string | null;
  manufacturer: string | null;
  unit_of_measure: string | null;
  pack_size: number | null;
  base_price: number;
  status: 'active' | 'archived';
};

export type Customer = {
  id: string;
  business_name: string;
  primary_contact_name: string | null;
  email: string | null;
  phone: string | null;
  status: 'active' | 'suspended' | 'archived';
};

export type UserProfile = {
  id: string;
  role: 'customer' | 'admin';
  customer_id: string | null;
  display_name: string | null;
};

// DTOs mirroring the gateway public API (snake_case, as sent over the wire).

export interface Money {
  amount_minor: number;
  currency: string;
}

export type Role = 'admin' | 'buyer';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Membership {
  organization_id: string;
  organization_name: string;
  role: Role;
}

export interface OrganizationContext {
  id: string;
  name: string;
  role: Role;
}

export interface LoginResponse {
  user: User;
  memberships: Membership[];
  organization: OrganizationContext | null;
  csrf_token: string;
}

export interface MeResponse {
  user: User;
  organization: OrganizationContext;
  memberships: Membership[];
}

export interface CsrfResponse {
  csrf_token: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  unit: 'kg';
  unit_price: Money;
  available_kg: number;
}

export interface LineItem {
  product_id: string;
  sku: string;
  name: string;
  quantity_kg: number;
  unit_price: Money;
  line_total: Money;
}

export type OrderStatus =
  | 'pending'
  | 'payment_pending'
  | 'confirmed'
  | 'payment_failed'
  | 'cancelled'
  | 'review_required';

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  lines: LineItem[];
  total: Money;
  invoice_id: string | null;
  failure_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  number: string;
  order_id: string;
  order_number: string;
  status: 'issued';
  customer_name: string;
  lines: LineItem[];
  total: Money;
  issued_at: string;
}

export interface ListResponse<T> {
  items: T[];
}

export interface CreateOrderRequest {
  lines: { product_id: string; quantity_kg: number }[];
}

export interface StockShortage {
  product_id: string;
  requested_kg: number;
  available_kg: number;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    request_id?: string;
    details?: Record<string, unknown>;
  };
}

import { request, setCsrfToken } from './client';
import type {
  CreateOrderRequest,
  Invoice,
  ListResponse,
  LoginResponse,
  MeResponse,
  Order,
  Product,
} from './types';

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await request<LoginResponse>('POST', '/auth/login', {
    body: { email, password },
    ignoreUnauthorized: true,
  });
  // Login rotates the CSRF cookie; keep the token that matches it.
  setCsrfToken(res.data.csrf_token);
  return res.data;
}

export async function logout(): Promise<void> {
  try {
    await request<void>('POST', '/auth/logout', { ignoreUnauthorized: true });
  } finally {
    setCsrfToken(null);
  }
}

export async function getMe(): Promise<MeResponse> {
  const res = await request<MeResponse>('GET', '/me', { ignoreUnauthorized: true });
  return res.data;
}

export async function listProducts(): Promise<Product[]> {
  const res = await request<ListResponse<Product>>('GET', '/products');
  return res.data.items;
}

/**
 * 201/200 return a final order, 202 returns an order still in `payment_pending`.
 * All three resolve with the Order; errors (402, 409, 5xx, ...) reject with ApiError.
 */
export async function createOrder(
  body: CreateOrderRequest,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<Order> {
  const res = await request<Order>('POST', '/orders', {
    body,
    headers: { 'Idempotency-Key': idempotencyKey },
    signal,
  });
  return res.data;
}

export async function listOrders(limit = 50): Promise<Order[]> {
  const res = await request<ListResponse<Order>>('GET', `/orders?limit=${limit}`);
  return res.data.items;
}

export async function getOrder(id: string): Promise<Order> {
  const res = await request<Order>('GET', `/orders/${encodeURIComponent(id)}`);
  return res.data;
}

export async function cancelOrder(id: string): Promise<Order> {
  const res = await request<Order>('POST', `/orders/${encodeURIComponent(id)}/cancel`);
  return res.data;
}

export async function reconcileOrder(id: string): Promise<Order> {
  const res = await request<Order>('POST', `/orders/${encodeURIComponent(id)}/reconcile`);
  return res.data;
}

export async function listInvoices(limit = 50): Promise<Invoice[]> {
  const res = await request<ListResponse<Invoice>>('GET', `/invoices?limit=${limit}`);
  return res.data.items;
}

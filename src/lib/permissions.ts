import type { UserRole } from './types/db';

/**
 * Formats a raw DB role value (e.g. `new_hire`) into a human-readable label
 * (e.g. `New Hire`) for display in the UI.
 */
export function formatRole(role: string | null | undefined): string {
  if (!role) return '';
  return role
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export type Permission =
  | 'view_dashboard'
  | 'manage_users'
  | 'manage_catalog'
  | 'manage_customers'
  | 'manage_orders'
  | 'manage_invoices'
  | 'manage_territories'
  | 'view_analytics'
  | 'manage_tasks';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // New hires - operational access (clients, tasks, orders, catalog), but no
  // financials/invoices, user management, or territories.
  new_hire: [
    'view_dashboard',
    'manage_customers',
    'manage_tasks',
    'manage_orders',
    'manage_catalog'
  ],

  // Sales reps - can view and manage customers, orders, tasks
  sales_rep: [
    'view_dashboard',
    'manage_customers',
    'manage_orders',
    'manage_tasks',
    'view_analytics'
  ],

  // Warehouse staff - can manage orders and view basic info
  warehouse_staff: ['view_dashboard', 'manage_orders'],

  // Accounting - can manage invoices, view orders and customers
  accounting: ['view_dashboard', 'manage_invoices', 'manage_orders', 'view_analytics'],

  // Admin - full access
  admin: [
    'view_dashboard',
    'manage_users',
    'manage_catalog',
    'manage_customers',
    'manage_orders',
    'manage_invoices',
    'manage_territories',
    'view_analytics',
    'manage_tasks'
  ],

  // Customer - external customer, no admin access
  customer: ['view_dashboard']
};

// Route-based permissions - map routes to required permissions.
// Keys are real URL paths (the admin pages live in the SvelteKit `(admin)` route
// group, which does NOT add a `/admin` URL prefix). Matching is segment-aware, so
// a key also covers its subpaths (e.g. '/reports' covers '/reports/profitability').
export const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  // CRM
  '/clients': ['manage_customers'],
  '/rmas': ['manage_customers'],
  '/tags': ['manage_customers'],
  '/tasks': ['manage_tasks'],
  '/territories': ['manage_territories'],
  // Commerce
  '/catalog': ['manage_catalog'],
  '/categories': ['manage_catalog'],
  '/featured-groups': ['manage_catalog'],
  '/image-generator': ['manage_catalog'],
  '/orders': ['manage_orders'],
  '/purchases': ['manage_orders'],
  // Finances
  '/dashboard': ['view_analytics'],
  '/insights': ['view_analytics'],
  '/reports': ['view_analytics'],
  '/invoices': ['manage_invoices'],
  // System
  '/admin-users': ['manage_users']
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Check if a role can access a route
 */
export function canAccessRoute(role: UserRole, routePath: string): boolean {
  // Find the most specific route rule that matches this path (exact match or a
  // parent segment, e.g. '/clients' matches '/clients/123').
  const matchKey = Object.keys(ROUTE_PERMISSIONS).find(
    (key) => routePath === key || routePath.startsWith(key + '/')
  );

  const requiredPermissions = matchKey ? ROUTE_PERMISSIONS[matchKey] : undefined;

  // If no specific permissions required, allow access
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  // Check if user has all required permissions
  return requiredPermissions.every((permission) => hasPermission(role, permission));
}

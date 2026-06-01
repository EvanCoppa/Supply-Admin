import type { UserRole } from './types/db';

export type Permission = 'view_dashboard' | 'manage_users' | 'manage_catalog' | 'manage_customers' | 'manage_orders' | 'manage_invoices' | 'manage_territories' | 'view_analytics' | 'manage_tasks';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // New hires - minimal access, just basics
  new_hire: [
    'view_dashboard'
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
  warehouse_staff: [
    'view_dashboard',
    'manage_orders'
  ],

  // Accounting - can manage invoices, view orders and customers
  accounting: [
    'view_dashboard',
    'manage_invoices',
    'manage_orders',
    'view_analytics'
  ],

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
  customer: [
    'view_dashboard'
  ]
};

// Route-based permissions - map routes to required permissions
export const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  '/admin/admin-users': ['manage_users'],
  '/admin/catalog': ['manage_catalog'],
  '/admin/clients': ['manage_customers'],
  '/admin/territories': ['manage_territories'],
  '/admin/tasks': ['manage_tasks']
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
  const requiredPermissions = ROUTE_PERMISSIONS[routePath];

  // If no specific permissions required, allow access
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  // Check if user has all required permissions
  return requiredPermissions.every(permission => hasPermission(role, permission));
}
